// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {InsurancePolicy} from "./InsurancePolicy.sol";
import {InsurancePool} from "./InsurancePool.sol";
import {InsuranceTypes} from "./libraries/InsuranceTypes.sol";
import {InsuranceEvents} from "./libraries/InsuranceEvents.sol";
import "./libraries/InsuranceErrors.sol";

/**
 * @title ClaimManager
 * @author Senior Solidity Architect
 * @notice Manages the claim lifecycle: submission, oracle-verified accident
 *         confirmation, insurer approval, and automatic payout. This
 *         contract owns claim state entirely — the SafetyScoreOracle
 *         contract is NOT involved in accident verification (that would mix
 *         two unrelated concerns); ORACLE_ROLE holders call this contract
 *         directly for accident verification, since claim state lives here.
 * @dev The `Claim` struct is kept to exactly the fields specified (id,
 *      policyId, amount, submitted, accidentVerified, approved, paid) — a
 *      claim's "rejected" outcome and "is currently pending" status are
 *      tracked in separate internal mappings rather than added to the
 *      struct, so the on-chain struct layout matches the spec exactly.
 *
 *      Role model:
 *      - DEFAULT_ADMIN_ROLE: grants/revokes roles below; multisig/timelock
 *        in production.
 *      - PAUSER_ROLE: may pause/unpause this contract in an emergency.
 *      - ORACLE_ROLE: held by the trusted off-chain oracle backend; the
 *        only accounts permitted to verify (or refute) a claimed accident.
 *      - INSURANCE_COMPANY_ROLE: may approve or reject claims. Approval
 *        automatically triggers payout in the same transaction.
 *
 *      This contract must itself hold SPENDER_ROLE on InsurancePool to
 *      call `payOut`, granted post-deployment by the InsurancePool admin
 *      (see deploy.js).
 */
contract ClaimManager is AccessControl, Pausable, ReentrancyGuard {
    // ---------------------------------------------------------------
    //                             ROLES
    // ---------------------------------------------------------------

    /// @notice Allowed to pause/unpause this contract in an emergency.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Allowed to verify (or refute) a claimed accident.
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    /// @notice Allowed to approve (triggering automatic payout) or reject claims.
    bytes32 public constant INSURANCE_COMPANY_ROLE = keccak256("INSURANCE_COMPANY_ROLE");

    // ---------------------------------------------------------------
    //                       IMMUTABLE DEPENDENCIES
    // ---------------------------------------------------------------

    /// @notice The InsurancePolicy contract this contract validates claims against.
    InsurancePolicy public immutable insurancePolicy;

    /// @notice The InsurancePool contract this contract triggers payouts from.
    InsurancePool public immutable insurancePool;

    // ---------------------------------------------------------------
    //                            STORAGE
    // ---------------------------------------------------------------

    /// @notice claimId => Claim record.
    mapping(uint256 => InsuranceTypes.Claim) private _claims;

    /// @notice claimId => whether a claim record exists at that ID.
    /// @dev Kept separate from the `submitted` field so `submitted` retains
    ///      its literal meaning ("this claim was submitted") as a permanent
    ///      historical bit, rather than being repurposed as an existence flag.
    mapping(uint256 => bool) private _claimExists;

    /// @notice claimId => whether the claim was rejected (by oracle refutation
    ///         or insurer decision). Kept outside the struct for the same
    ///         reason as `_claimExists`.
    mapping(uint256 => bool) private _claimRejected;

    /// @notice policyId => claimId of the currently pending (unresolved) claim
    ///         on that policy, or 0 if none. This is the core anti-double-claim
    ///         guard: only one unresolved claim per policy at a time.
    mapping(uint256 => uint256) private _pendingClaimByPolicy;

    /// @notice Monotonically increasing counter for the next claim ID to assign.
    uint256 private _nextClaimId = 1;

    // ---------------------------------------------------------------
    //                          CONSTRUCTOR
    // ---------------------------------------------------------------

    /**
     * @param admin The address to receive DEFAULT_ADMIN_ROLE and PAUSER_ROLE.
     * @param insurancePolicy_ Deployed InsurancePolicy contract address.
     * @param insurancePool_ Deployed InsurancePool contract address.
     */
    constructor(address admin, address insurancePolicy_, address insurancePool_) {
        if (admin == address(0)) revert ZeroAddress();
        if (insurancePolicy_ == address(0)) revert ZeroAddress();
        if (insurancePool_ == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        insurancePolicy = InsurancePolicy(insurancePolicy_);
        insurancePool = InsurancePool(payable(insurancePool_));
    }

    // ---------------------------------------------------------------
    //                        CLAIM SUBMISSION
    // ---------------------------------------------------------------

    /**
     * @notice Submits a new claim against an active policy.
     * @dev Only the policy's driver may submit a claim on it. Reverts if
     *      the policy is not currently active (covers both cancelled and
     *      expired policies), the requested amount exceeds coverage, or a
     *      prior claim on the same policy is still unresolved (the
     *      duplicate-claim guard).
     * @param policyId The policy ID to claim against.
     * @param amount The amount being claimed, in wei.
     * @return claimId The newly created claim ID.
     */
    function submitClaim(uint256 policyId, uint256 amount) external whenNotPaused returns (uint256 claimId) {
        InsuranceTypes.Policy memory policy = insurancePolicy.getPolicy(policyId);
        if (policy.driver != msg.sender) revert NotPolicyOwner(msg.sender, policyId);
        if (!insurancePolicy.isPolicyActive(policyId)) revert PolicyNotActive(policyId);
        if (amount == 0) revert ZeroAmount();
        if (amount > policy.coverage) revert ClaimExceedsCoverage(amount, policy.coverage);

        uint256 pending = _pendingClaimByPolicy[policyId];
        if (pending != 0) revert ClaimAlreadyPending(policyId, pending);

        claimId = _nextClaimId++;

        _claims[claimId] = InsuranceTypes.Claim({
            id: claimId,
            policyId: policyId,
            amount: amount,
            submitted: true,
            accidentVerified: false,
            approved: false,
            paid: false
        });
        _claimExists[claimId] = true;
        _pendingClaimByPolicy[policyId] = claimId;

        emit InsuranceEvents.ClaimSubmitted(claimId, policyId, amount);
    }

    // ---------------------------------------------------------------
    //                      ORACLE ACCIDENT VERIFICATION
    // ---------------------------------------------------------------

    /**
     * @notice Records the oracle's verification of the accident underlying a claim.
     * @dev Restricted to ORACLE_ROLE. If `isLegitimate` is false, the claim
     *      is immediately rejected (`ClaimRejected` is emitted and the
     *      pending-claim slot is freed so the driver may submit a corrected
     *      claim later). Reverts with `InvalidClaimState` if the claim was
     *      already rejected, approved, paid, or previously verified.
     * @param claimId The claim ID to verify.
     * @param isLegitimate Whether the oracle confirms the accident is legitimate.
     */
    function verifyAccident(uint256 claimId, bool isLegitimate) external onlyRole(ORACLE_ROLE) whenNotPaused {
        if (!_claimExists[claimId]) revert ClaimNotFound(claimId);
        InsuranceTypes.Claim storage claim = _claims[claimId];
        if (_claimRejected[claimId] || claim.approved || claim.paid || claim.accidentVerified) {
            revert InvalidClaimState(claimId);
        }

        if (isLegitimate) {
            claim.accidentVerified = true;
        } else {
            _rejectClaim(claimId, claim.policyId, "Accident could not be verified", msg.sender);
        }
    }

    // ---------------------------------------------------------------
    //                    INSURER APPROVAL & AUTO-PAYOUT
    // ---------------------------------------------------------------

    /**
     * @notice Approves a verified claim and automatically transfers payout.
     * @dev Restricted to INSURANCE_COMPANY_ROLE. Requires the accident to
     *      have been oracle-verified first. Re-checks the policy is still
     *      active at approval time (it may have expired since submission),
     *      reverting with `PolicyExpired` if so. Follows checks-effects-
     *      interactions: `approved`/`paid` are set and the pending-claim
     *      slot is cleared BEFORE the external payout call, and
     *      `nonReentrant` guards the call itself — this also means a
     *      reentrant call back into this function fails the `!claim.paid`
     *      check even before the guard is considered.
     * @param claimId The claim ID to approve and pay out.
     */
    function approveClaim(uint256 claimId) external onlyRole(INSURANCE_COMPANY_ROLE) whenNotPaused nonReentrant {
        if (!_claimExists[claimId]) revert ClaimNotFound(claimId);
        InsuranceTypes.Claim storage claim = _claims[claimId];
        if (_claimRejected[claimId]) revert InvalidClaimState(claimId);
        if (!claim.accidentVerified) revert AccidentNotVerified(claimId);
        if (claim.approved || claim.paid) revert DuplicatePayout(claimId);

        InsuranceTypes.Policy memory policy = insurancePolicy.getPolicy(claim.policyId);
        if (!insurancePolicy.isPolicyActive(claim.policyId)) {
            revert PolicyExpired(claim.policyId, policy.expiryTime);
        }

        // Effects before interactions.
        claim.approved = true;
        claim.paid = true;
        delete _pendingClaimByPolicy[claim.policyId];

        emit InsuranceEvents.ClaimApproved(claimId, msg.sender);

        bool success = insurancePool.payOut(payable(policy.driver), claim.amount);
        if (!success) revert TransferFailed(policy.driver, claim.amount);

        emit InsuranceEvents.PayoutCompleted(claimId, policy.driver, claim.amount);
    }

    /**
     * @notice Rejects a claim outright (e.g. suspected fraud), regardless of
     *         its accident-verification state, as long as it has not already
     *         been approved or paid.
     * @dev Restricted to INSURANCE_COMPANY_ROLE.
     * @param claimId The claim ID to reject.
     * @param reason A short human-readable reason, included in the event.
     */
    function rejectClaim(
        uint256 claimId,
        string calldata reason
    ) external onlyRole(INSURANCE_COMPANY_ROLE) whenNotPaused {
        if (!_claimExists[claimId]) revert ClaimNotFound(claimId);
        InsuranceTypes.Claim storage claim = _claims[claimId];
        if (_claimRejected[claimId] || claim.approved || claim.paid) revert InvalidClaimState(claimId);

        _rejectClaim(claimId, claim.policyId, reason, msg.sender);
    }

    // ---------------------------------------------------------------
    //                        VIEW FUNCTIONS
    // ---------------------------------------------------------------

    /**
     * @notice Returns the full on-chain record for a claim.
     * @dev Reverts with `ClaimNotFound` if `claimId` does not exist.
     * @param claimId The claim ID to look up.
     * @return claim The `InsuranceTypes.Claim` record.
     */
    function getClaim(uint256 claimId) external view returns (InsuranceTypes.Claim memory claim) {
        if (!_claimExists[claimId]) revert ClaimNotFound(claimId);
        return _claims[claimId];
    }

    /**
     * @notice Returns whether a claim was rejected.
     * @param claimId The claim ID to check.
     * @return rejected True if the claim was rejected by the oracle or the insurer.
     */
    function isClaimRejected(uint256 claimId) external view returns (bool rejected) {
        return _claimRejected[claimId];
    }

    /**
     * @notice Returns the claim ID currently pending resolution on a policy, if any.
     * @param policyId The policy ID to check.
     * @return claimId The pending claim ID, or 0 if none is pending.
     */
    function getPendingClaim(uint256 policyId) external view returns (uint256 claimId) {
        return _pendingClaimByPolicy[policyId];
    }

    // ---------------------------------------------------------------
    //                        EMERGENCY CONTROL
    // ---------------------------------------------------------------

    /// @notice Pauses claim submission, verification, approval, and rejection.
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

    /// @dev Shared rejection path used by both oracle refutation and insurer rejection.
    function _rejectClaim(uint256 claimId, uint256 policyId, string memory reason, address by) private {
        _claimRejected[claimId] = true;
        delete _pendingClaimByPolicy[policyId];
        emit InsuranceEvents.ClaimRejected(claimId, reason, by);
    }
}
