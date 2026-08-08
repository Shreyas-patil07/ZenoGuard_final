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

contract ClaimManager is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant INSURANCE_COMPANY_ROLE = keccak256("INSURANCE_COMPANY_ROLE");

    InsurancePolicy public immutable insurancePolicy;
    InsurancePool public immutable insurancePool;

    mapping(uint256 => InsuranceTypes.Claim) private _claims;
    mapping(uint256 => bool) private _claimExists;
    mapping(uint256 => bool) private _claimRejected;
    mapping(uint256 => uint256) private _pendingClaimByPolicy;
    uint256 private _nextClaimId = 1;

    event ClaimAuthorized(uint256 indexed claimId, address indexed authorizedBy);

    constructor(address admin, address insurancePolicy_, address insurancePool_) {
        if (admin == address(0)) revert ZeroAddress();
        if (insurancePolicy_ == address(0)) revert ZeroAddress();
        if (insurancePool_ == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        insurancePolicy = InsurancePolicy(insurancePolicy_);
        insurancePool = InsurancePool(payable(insurancePool_));
    }

    function submitClaim(uint256 policyId, uint256 amount) external whenNotPaused returns (uint256 claimId) {
        return _submitClaim(msg.sender, policyId, amount);
    }

    function submitClaimFor(
        address driver,
        uint256 policyId,
        uint256 amount
    ) external onlyRole(INSURANCE_COMPANY_ROLE) whenNotPaused returns (uint256 claimId) {
        return _submitClaim(driver, policyId, amount);
    }

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

    function authorizeClaim(uint256 claimId) external onlyRole(INSURANCE_COMPANY_ROLE) whenNotPaused {
        if (!_claimExists[claimId]) revert ClaimNotFound(claimId);
        InsuranceTypes.Claim storage claim = _claims[claimId];
        if (_claimRejected[claimId] || !claim.accidentVerified || claim.approved || claim.paid) {
            revert InvalidClaimState(claimId);
        }

        if (!insurancePolicy.isPolicyActive(claim.policyId)) {
            InsuranceTypes.Policy memory policy = insurancePolicy.getPolicy(claim.policyId);
            revert PolicyExpired(claim.policyId, policy.expiryTime);
        }

        claim.approved = true;
        delete _pendingClaimByPolicy[claim.policyId];
        emit ClaimAuthorized(claimId, msg.sender);
    }

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

        claim.approved = true;
        claim.paid = true;
        delete _pendingClaimByPolicy[claim.policyId];

        emit InsuranceEvents.ClaimApproved(claimId, msg.sender);

        bool success = insurancePool.payOut(payable(policy.driver), claim.amount);
        if (!success) revert TransferFailed(policy.driver, claim.amount);

        emit InsuranceEvents.PayoutCompleted(claimId, policy.driver, claim.amount);
    }

    function rejectClaim(uint256 claimId, string calldata reason) external onlyRole(INSURANCE_COMPANY_ROLE) whenNotPaused {
        if (!_claimExists[claimId]) revert ClaimNotFound(claimId);
        InsuranceTypes.Claim storage claim = _claims[claimId];
        if (_claimRejected[claimId] || claim.approved || claim.paid) revert InvalidClaimState(claimId);

        _rejectClaim(claimId, claim.policyId, reason, msg.sender);
    }

    function getClaim(uint256 claimId) external view returns (InsuranceTypes.Claim memory claim) {
        if (!_claimExists[claimId]) revert ClaimNotFound(claimId);
        return _claims[claimId];
    }

    function isClaimRejected(uint256 claimId) external view returns (bool rejected) {
        return _claimRejected[claimId];
    }

    function getPendingClaim(uint256 policyId) external view returns (uint256 claimId) {
        return _pendingClaimByPolicy[policyId];
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit InsuranceEvents.EmergencyPaused(msg.sender);
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit InsuranceEvents.EmergencyUnpaused(msg.sender);
    }

    function _submitClaim(address driver, uint256 policyId, uint256 amount) internal returns (uint256 claimId) {
        InsuranceTypes.Policy memory policy = insurancePolicy.getPolicy(policyId);
        if (policy.driver != driver) revert NotPolicyOwner(driver, policyId);
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

    function _rejectClaim(uint256 claimId, uint256 policyId, string memory reason, address by) private {
        _claimRejected[claimId] = true;
        delete _pendingClaimByPolicy[policyId];
        emit InsuranceEvents.ClaimRejected(claimId, reason, by);
    }
}
