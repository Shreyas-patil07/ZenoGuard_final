// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {DriverRegistry} from "./DriverRegistry.sol";
import {SafetyScoreOracle} from "./SafetyScoreOracle.sol";
import {InsurancePool} from "./InsurancePool.sol";
import {InsuranceTypes} from "./libraries/InsuranceTypes.sol";
import {InsuranceEvents} from "./libraries/InsuranceEvents.sol";
import "./libraries/InsuranceErrors.sol";

/**
 * @title InsurancePolicy
 * @author Senior Solidity Architect
 * @notice Manages the insurance policy lifecycle (purchase, renew, cancel,
 *         premium updates) and applies the deterministic safety-score-based
 *         premium adjustment. Reads verified scores from SafetyScoreOracle
 *         and links purchased policies into DriverRegistry — it performs NO
 *         AI computation itself; scoring is entirely off-chain, this
 *         contract only applies a fixed, auditable pricing formula to a
 *         verified score.
 * @dev Off-chain actuarial pricing (the "base premium" for a given coverage
 *      amount) is computed by the backend and passed in at purchase/renewal
 *      time; this contract's only on-chain pricing responsibility is the
 *      deterministic tier adjustment below:
 *
 *        Score 90-100  => 20% discount  (80% of base premium)
 *        Score 75-89   => normal premium (100% of base premium)
 *        Score 60-74   => 10% surcharge (110% of base premium)
 *        Score 0-59    => normal premium, policy flagged `underReview`
 *
 *      Role model:
 *      - DEFAULT_ADMIN_ROLE: grants/revokes roles below; multisig/timelock
 *        in production.
 *      - PAUSER_ROLE: may pause/unpause this contract in an emergency.
 *      - INSURANCE_COMPANY_ROLE: may administratively update a policy's
 *        premium and force-cancel policies (e.g. fraud response).
 *
 *      This contract must itself hold POLICY_MANAGER_ROLE on DriverRegistry
 *      to call `linkPolicy`, granted post-deployment by the DriverRegistry
 *      admin (see deploy.js).
 */
contract InsurancePolicy is AccessControl, Pausable, ReentrancyGuard {
    // ---------------------------------------------------------------
    //                             ROLES
    // ---------------------------------------------------------------

    /// @notice Allowed to pause/unpause this contract in an emergency.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Allowed to administratively update premiums and force-cancel policies.
    bytes32 public constant INSURANCE_COMPANY_ROLE = keccak256("INSURANCE_COMPANY_ROLE");

    // ---------------------------------------------------------------
    //                           CONSTANTS
    // ---------------------------------------------------------------

    /// @notice Fixed policy term applied on every purchase/renewal.
    uint64 public constant POLICY_DURATION = 365 days;

    /// @notice Basis-point denominator used for premium multiplier math.
    uint256 private constant BPS_DENOMINATOR = 10_000;

    /// @notice 80% of base premium => a 20% discount (score 90-100).
    uint256 private constant DISCOUNT_MULTIPLIER_BPS = 8_000;

    /// @notice 110% of base premium => a 10% surcharge (score 60-74).
    uint256 private constant SURCHARGE_MULTIPLIER_BPS = 11_000;

    /// @notice Safety score threshold at/above which a policy is normal (no surcharge).
    uint8 private constant SCORE_NORMAL_MIN = 75;

    /// @notice Safety score threshold at/above which a policy earns a discount.
    uint8 private constant SCORE_DISCOUNT_MIN = 90;

    /// @notice Safety score threshold at/above which no review is triggered.
    uint8 private constant SCORE_REVIEW_MIN = 60;

    // ---------------------------------------------------------------
    //                       IMMUTABLE DEPENDENCIES
    // ---------------------------------------------------------------

    /// @notice The DriverRegistry this contract links purchased policies into.
    DriverRegistry public immutable driverRegistry;

    /// @notice The SafetyScoreOracle this contract reads verified scores from.
    SafetyScoreOracle public immutable safetyScoreOracle;

    /// @notice The InsurancePool that receives forwarded premium payments.
    InsurancePool public immutable insurancePool;

    // ---------------------------------------------------------------
    //                            STORAGE
    // ---------------------------------------------------------------

    /// @notice policyId => Policy record.
    mapping(uint256 => InsuranceTypes.Policy) private _policies;

    /// @notice Monotonically increasing counter for the next policy ID to assign.
    /// @dev Starts at 1 so that 0 can safely mean "no policy" throughout the protocol.
    uint256 private _nextPolicyId = 1;

    // ---------------------------------------------------------------
    //                          CONSTRUCTOR
    // ---------------------------------------------------------------

    /**
     * @param admin The address to receive DEFAULT_ADMIN_ROLE and PAUSER_ROLE.
     * @param driverRegistry_ Deployed DriverRegistry contract address.
     * @param safetyScoreOracle_ Deployed SafetyScoreOracle contract address.
     * @param insurancePool_ Deployed InsurancePool contract address.
     */
    constructor(address admin, address driverRegistry_, address safetyScoreOracle_, address insurancePool_) {
        if (admin == address(0)) revert ZeroAddress();
        if (driverRegistry_ == address(0)) revert ZeroAddress();
        if (safetyScoreOracle_ == address(0)) revert ZeroAddress();
        if (insurancePool_ == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        driverRegistry = DriverRegistry(driverRegistry_);
        safetyScoreOracle = SafetyScoreOracle(safetyScoreOracle_);
        insurancePool = InsurancePool(payable(insurancePool_));
    }

    // ---------------------------------------------------------------
    //                       POLICY LIFECYCLE
    // ---------------------------------------------------------------

    /**
     * @notice Purchases a new insurance policy for the caller.
     * @dev `basePremium` is the off-chain-computed actuarial premium for
     *      `coverageAmount`, supplied by the backend/frontend; this function
     *      applies the deterministic score-tier adjustment on top of it and
     *      requires exact payment of the resulting amount. Reverts if the
     *      caller is not a registered driver, already holds an active
     *      policy, or sends the wrong ETH amount. Forwards payment to
     *      InsurancePool and links the new policy into DriverRegistry.
     * @param basePremium The off-chain-computed base premium, in wei, before
     *                     the safety-score adjustment.
     * @param coverageAmount The maximum payout coverage for this policy, in wei.
     * @return policyId The newly created policy ID.
     */
    function purchasePolicy(
        uint256 basePremium,
        uint256 coverageAmount
    ) external payable whenNotPaused nonReentrant returns (uint256 policyId) {
        if (basePremium == 0) revert ZeroAmount();
        if (coverageAmount == 0) revert ZeroAmount();
        if (!driverRegistry.isRegistered(msg.sender)) revert DriverNotRegistered(msg.sender);

        InsuranceTypes.Driver memory driver = driverRegistry.getDriver(msg.sender);
        if (driver.policyId != 0 && _isActive(_policies[driver.policyId])) {
            revert PolicyAlreadyActive(msg.sender);
        }

        uint8 score = safetyScoreOracle.latestScore(msg.sender);
        (uint256 finalPremium, bool underReview) = _calculatePremium(basePremium, score);

        if (msg.value != finalPremium) revert IncorrectPremiumAmount(finalPremium, msg.value);

        policyId = _nextPolicyId++;
        uint64 startTime = uint64(block.timestamp);
        uint64 expiryTime = startTime + POLICY_DURATION;

        _policies[policyId] = InsuranceTypes.Policy({
            id: policyId,
            driver: msg.sender,
            premium: finalPremium,
            coverage: coverageAmount,
            startTime: startTime,
            expiryTime: expiryTime,
            active: true,
            underReview: underReview
        });

        // Effects are complete before external interactions below.
        driverRegistry.linkPolicy(msg.sender, policyId);
        insurancePool.deposit{value: msg.value}();

        emit InsuranceEvents.PolicyPurchased(policyId, msg.sender, finalPremium, coverageAmount, expiryTime);
    }

    /**
     * @notice Renews an existing policy for another full term.
     * @dev Only the policy's driver may renew it. Re-applies the current
     *      safety-score tier to the newly supplied base premium. Resets
     *      `startTime`/`expiryTime` to a fresh 365-day term and reactivates
     *      the policy (including clearing a prior `underReview` flag if the
     *      score has since improved).
     * @param policyId The policy ID to renew.
     * @param newBasePremium The off-chain-computed base premium for the
     *                        renewal term, in wei, before score adjustment.
     */
    function renewPolicy(uint256 policyId, uint256 newBasePremium) external payable whenNotPaused nonReentrant {
        InsuranceTypes.Policy storage policy = _policies[policyId];
        if (policy.driver == address(0)) revert PolicyNotFound(policyId);
        if (policy.driver != msg.sender) revert NotPolicyOwner(msg.sender, policyId);
        if (newBasePremium == 0) revert ZeroAmount();

        uint8 score = safetyScoreOracle.latestScore(msg.sender);
        (uint256 finalPremium, bool underReview) = _calculatePremium(newBasePremium, score);

        if (msg.value != finalPremium) revert IncorrectPremiumAmount(finalPremium, msg.value);

        uint64 startTime = uint64(block.timestamp);
        uint64 expiryTime = startTime + POLICY_DURATION;

        policy.premium = finalPremium;
        policy.startTime = startTime;
        policy.expiryTime = expiryTime;
        policy.active = true;
        policy.underReview = underReview;

        insurancePool.deposit{value: msg.value}();

        emit InsuranceEvents.PolicyRenewed(policyId, finalPremium, expiryTime);
    }

    /**
     * @notice Cancels a policy, immediately ending coverage.
     * @dev Callable by the policy's driver, or by an INSURANCE_COMPANY_ROLE
     *      holder (e.g. fraud response / regulatory action). No premium
     *      refund logic is applied — out of scope for this lean build.
     * @param policyId The policy ID to cancel.
     */
    function cancelPolicy(uint256 policyId) external whenNotPaused {
        InsuranceTypes.Policy storage policy = _policies[policyId];
        if (policy.driver == address(0)) revert PolicyNotFound(policyId);
        if (msg.sender != policy.driver && !hasRole(INSURANCE_COMPANY_ROLE, msg.sender)) {
            revert NotPolicyOwner(msg.sender, policyId);
        }

        policy.active = false;

        emit InsuranceEvents.PolicyCancelled(policyId, msg.sender);
    }

    /**
     * @notice Administratively overrides a policy's stored premium value.
     * @dev Restricted to INSURANCE_COMPANY_ROLE. This is a bookkeeping
     *      override (e.g. correcting a pricing error) and does NOT collect
     *      or refund any ETH — it only updates the recorded premium amount.
     * @param policyId The policy ID to update.
     * @param newPremium The corrected premium amount, in wei.
     */
    function updatePremium(
        uint256 policyId,
        uint256 newPremium
    ) external onlyRole(INSURANCE_COMPANY_ROLE) whenNotPaused {
        InsuranceTypes.Policy storage policy = _policies[policyId];
        if (policy.driver == address(0)) revert PolicyNotFound(policyId);

        uint256 oldPremium = policy.premium;
        policy.premium = newPremium;

        emit InsuranceEvents.PremiumUpdated(policyId, oldPremium, newPremium);
    }

    // ---------------------------------------------------------------
    //                        VIEW FUNCTIONS
    // ---------------------------------------------------------------

    /**
     * @notice Returns whether a policy is currently active.
     * @dev Lazy-expiry check: a policy is active only if its `active` flag
     *      is set AND the current block timestamp has not passed its
     *      `expiryTime`. No state transition transaction is required for a
     *      policy to be treated as expired.
     * @param policyId The policy ID to check.
     * @return active True if the policy is in force right now.
     */
    function isPolicyActive(uint256 policyId) external view returns (bool active) {
        return _isActive(_policies[policyId]);
    }

    /**
     * @notice Returns the full on-chain record for a policy.
     * @dev Reverts with `PolicyNotFound` if `policyId` does not exist.
     * @param policyId The policy ID to look up.
     * @return policy The `InsuranceTypes.Policy` record.
     */
    function getPolicy(uint256 policyId) external view returns (InsuranceTypes.Policy memory policy) {
        if (_policies[policyId].driver == address(0)) revert PolicyNotFound(policyId);
        return _policies[policyId];
    }

    // ---------------------------------------------------------------
    //                        EMERGENCY CONTROL
    // ---------------------------------------------------------------

    /// @notice Pauses purchase, renewal, cancellation, and premium updates.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit InsuranceEvents.EmergencyPaused(msg.sender);
    }

    /// @notice Resumes normal operation after a pause.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit InsuranceEvents.EmergencyUnpaused(msg.sender);
    }

    // ---------------------------------------------------------------
    //                        INTERNAL HELPERS
    // ---------------------------------------------------------------

    /**
     * @dev Applies the fixed safety-score premium tiers to a base premium.
     *      Pure function — takes the score as input rather than reading
     *      the oracle itself, keeping it independently testable.
     * @param basePremium The off-chain-computed base premium, in wei.
     * @param score The driver's latest verified safety score (0-100).
     * @return finalPremium The premium after tier adjustment, in wei.
     * @return underReview True if the score is below the review threshold (<60).
     */
    function _calculatePremium(
        uint256 basePremium,
        uint8 score
    ) internal pure returns (uint256 finalPremium, bool underReview) {
        if (score >= SCORE_DISCOUNT_MIN) {
            finalPremium = (basePremium * DISCOUNT_MULTIPLIER_BPS) / BPS_DENOMINATOR;
        } else if (score >= SCORE_NORMAL_MIN) {
            finalPremium = basePremium;
        } else if (score >= SCORE_REVIEW_MIN) {
            finalPremium = (basePremium * SURCHARGE_MULTIPLIER_BPS) / BPS_DENOMINATOR;
        } else {
            finalPremium = basePremium;
            underReview = true;
        }
    }

    /// @dev A policy is active iff its flag is set and it has not yet expired.
    function _isActive(InsuranceTypes.Policy storage policy) internal view returns (bool) {
        return policy.active && block.timestamp <= policy.expiryTime;
    }
}
