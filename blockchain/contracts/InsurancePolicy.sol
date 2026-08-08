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

contract InsurancePolicy is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant INSURANCE_COMPANY_ROLE = keccak256("INSURANCE_COMPANY_ROLE");

    uint64 public constant DURATION_7_DAYS = 7 days;
    uint64 public constant DURATION_30_DAYS = 30 days;
    uint64 public constant DURATION_90_DAYS = 90 days;

    DriverRegistry public immutable driverRegistry;
    SafetyScoreOracle public immutable safetyScoreOracle;
    InsurancePool public immutable insurancePool;

    mapping(uint256 => InsuranceTypes.Policy) private _policies;
    uint256 private _nextPolicyId = 1;

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

    function purchasePolicy(
        uint256 premium,
        uint256 coverageAmount,
        uint64 durationSeconds
    ) external payable whenNotPaused nonReentrant returns (uint256 policyId) {
        if (premium == 0) revert ZeroAmount();
        if (coverageAmount == 0) revert ZeroAmount();
        _validateDuration(durationSeconds);

        if (!driverRegistry.isRegistered(msg.sender)) revert DriverNotRegistered(msg.sender);

        InsuranceTypes.Driver memory driver = driverRegistry.getDriver(msg.sender);
        if (driver.policyId != 0 && _isActive(_policies[driver.policyId])) {
            revert PolicyAlreadyActive(msg.sender);
        }

        if (msg.value != premium) revert IncorrectPremiumAmount(premium, msg.value);

        policyId = _nextPolicyId++;
        uint64 startTime = uint64(block.timestamp);
        uint64 expiryTime = startTime + durationSeconds;

        _policies[policyId] = InsuranceTypes.Policy({
            id: policyId,
            driver: msg.sender,
            premium: premium,
            coverage: coverageAmount,
            startTime: startTime,
            expiryTime: expiryTime,
            active: true,
            underReview: false
        });

        driverRegistry.linkPolicy(msg.sender, policyId);
        insurancePool.deposit{value: msg.value}();

        emit InsuranceEvents.PolicyPurchased(policyId, msg.sender, premium, coverageAmount, expiryTime);
    }

    function renewPolicy(
        uint256 policyId,
        uint256 newPremium,
        uint64 durationSeconds
    ) external payable whenNotPaused nonReentrant {
        InsuranceTypes.Policy storage policy = _policies[policyId];
        if (policy.driver == address(0)) revert PolicyNotFound(policyId);
        if (policy.driver != msg.sender) revert NotPolicyOwner(msg.sender, policyId);
        if (newPremium == 0) revert ZeroAmount();
        _validateDuration(durationSeconds);
        if (msg.value != newPremium) revert IncorrectPremiumAmount(newPremium, msg.value);

        uint64 startTime = uint64(block.timestamp);
        uint64 expiryTime = startTime + durationSeconds;

        policy.premium = newPremium;
        policy.startTime = startTime;
        policy.expiryTime = expiryTime;
        policy.active = true;
        policy.underReview = false;

        insurancePool.deposit{value: msg.value}();
        emit InsuranceEvents.PolicyRenewed(policyId, newPremium, expiryTime);
    }

    function cancelPolicy(uint256 policyId) external whenNotPaused {
        InsuranceTypes.Policy storage policy = _policies[policyId];
        if (policy.driver == address(0)) revert PolicyNotFound(policyId);
        if (msg.sender != policy.driver && !hasRole(INSURANCE_COMPANY_ROLE, msg.sender)) {
            revert NotPolicyOwner(msg.sender, policyId);
        }

        policy.active = false;
        emit InsuranceEvents.PolicyCancelled(policyId, msg.sender);
    }

    function updatePremium(uint256 policyId, uint256 newPremium) external onlyRole(INSURANCE_COMPANY_ROLE) whenNotPaused {
        InsuranceTypes.Policy storage policy = _policies[policyId];
        if (policy.driver == address(0)) revert PolicyNotFound(policyId);

        uint256 oldPremium = policy.premium;
        policy.premium = newPremium;
        emit InsuranceEvents.PremiumUpdated(policyId, oldPremium, newPremium);
    }

    function isPolicyActive(uint256 policyId) external view returns (bool active) {
        return _isActive(_policies[policyId]);
    }

    function getPolicy(uint256 policyId) external view returns (InsuranceTypes.Policy memory policy) {
        if (_policies[policyId].driver == address(0)) revert PolicyNotFound(policyId);
        return _policies[policyId];
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit InsuranceEvents.EmergencyPaused(msg.sender);
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit InsuranceEvents.EmergencyUnpaused(msg.sender);
    }

    function _validateDuration(uint64 durationSeconds) internal pure {
        if (
            durationSeconds != DURATION_7_DAYS &&
            durationSeconds != DURATION_30_DAYS &&
            durationSeconds != DURATION_90_DAYS
        ) {
            revert InvalidDuration(durationSeconds);
        }
    }

    function _isActive(InsuranceTypes.Policy storage policy) internal view returns (bool) {
        return policy.active && block.timestamp <= policy.expiryTime;
    }
}
