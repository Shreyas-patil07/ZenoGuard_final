// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {InsuranceTypes} from "./libraries/InsuranceTypes.sol";
import {InsuranceEvents} from "./libraries/InsuranceEvents.sol";
import "./libraries/InsuranceErrors.sol";

contract DriverRegistry is AccessControl, Pausable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant POLICY_MANAGER_ROLE = keccak256("POLICY_MANAGER_ROLE");

    mapping(address => InsuranceTypes.Driver) private _drivers;

    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function registerDriver(bytes32 driverId) external whenNotPaused {
        _registerDriver(msg.sender, driverId);
    }

    function registerDriverFor(address wallet, bytes32 driverId) external onlyRole(POLICY_MANAGER_ROLE) whenNotPaused {
        _registerDriver(wallet, driverId);
    }

    function getDriver(address wallet) external view returns (InsuranceTypes.Driver memory driver) {
        if (!_drivers[wallet].registered) revert DriverNotRegistered(wallet);
        return _drivers[wallet];
    }

    function isRegistered(address wallet) external view returns (bool registered) {
        return _drivers[wallet].registered;
    }

    function linkPolicy(address wallet, uint256 policyId) external onlyRole(POLICY_MANAGER_ROLE) whenNotPaused {
        if (!_drivers[wallet].registered) revert DriverNotRegistered(wallet);
        _drivers[wallet].policyId = policyId;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit InsuranceEvents.EmergencyPaused(msg.sender);
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit InsuranceEvents.EmergencyUnpaused(msg.sender);
    }

    function _registerDriver(address wallet, bytes32 driverId) internal {
        if (wallet == address(0)) revert ZeroAddress();
        if (_drivers[wallet].registered) revert DriverAlreadyRegistered(wallet);
        if (driverId == bytes32(0)) revert ZeroAmount();

        _drivers[wallet] = InsuranceTypes.Driver({
            wallet: wallet,
            driverId: driverId,
            policyId: 0,
            registered: true
        });

        emit InsuranceEvents.DriverRegistered(wallet, driverId);
    }
}
