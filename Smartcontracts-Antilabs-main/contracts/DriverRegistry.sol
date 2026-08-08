// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {InsuranceTypes} from "./libraries/InsuranceTypes.sol";
import {InsuranceEvents} from "./libraries/InsuranceEvents.sol";
import "./libraries/InsuranceErrors.sol";

/**
 * @title DriverRegistry
 * @author Senior Solidity Architect
 * @notice Minimal on-chain link between a wallet, an off-chain driver
 *         identity, and an active policy ID. Stores nothing else — trip
 *         history, AI inputs, documents, and telemetry all live off-chain
 *         in the backend, per project scope.
 * @dev `driverId` is a bytes32 handle minted off-chain (e.g. a hash of a
 *      backend UUID) and passed in at registration time; this contract does
 *      not generate identity, it only anchors it on-chain and prevents a
 *      wallet from registering twice.
 *
 *      Role model:
 *      - DEFAULT_ADMIN_ROLE: grants/revokes all roles below; should be a
 *        multisig/timelock in production, not an EOA.
 *      - PAUSER_ROLE: may pause/unpause this contract in an emergency.
 *      - POLICY_MANAGER_ROLE: granted exclusively to the deployed
 *        InsurancePolicy contract address, allowing it (and only it) to
 *        link a policy ID to a driver once a policy is purchased.
 */
contract DriverRegistry is AccessControl, Pausable {
    // ---------------------------------------------------------------
    //                             ROLES
    // ---------------------------------------------------------------

    /// @notice Allowed to pause/unpause this contract in an emergency.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Granted exclusively to the InsurancePolicy contract address,
    ///         allowing it to link a purchased policy ID to a driver record.
    bytes32 public constant POLICY_MANAGER_ROLE = keccak256("POLICY_MANAGER_ROLE");

    // ---------------------------------------------------------------
    //                            STORAGE
    // ---------------------------------------------------------------

    /// @notice wallet => Driver record.
    mapping(address => InsuranceTypes.Driver) private _drivers;

    // ---------------------------------------------------------------
    //                          CONSTRUCTOR
    // ---------------------------------------------------------------

    /**
     * @param admin The address to receive DEFAULT_ADMIN_ROLE and PAUSER_ROLE.
     *              In production this should be a multisig or timelock.
     */
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ---------------------------------------------------------------
    //                       DRIVER REGISTRATION
    // ---------------------------------------------------------------

    /**
     * @notice Registers the caller's wallet as a driver, linked to an
     *         off-chain-assigned driver identifier.
     * @dev Self-service only: a wallet can register itself, but nothing else
     *      can register on its behalf, since driver identity is tied 1:1 to
     *      the wallet signing the transaction. Reverts with
     *      `DriverAlreadyRegistered` if the caller has already registered.
     * @param driverId The off-chain-assigned driver identifier (e.g. a hash
     *                  of a backend UUID) to anchor on-chain.
     */
    function registerDriver(bytes32 driverId) external whenNotPaused {
        if (_drivers[msg.sender].registered) revert DriverAlreadyRegistered(msg.sender);
        if (driverId == bytes32(0)) revert ZeroAmount();

        _drivers[msg.sender] = InsuranceTypes.Driver({
            wallet: msg.sender,
            driverId: driverId,
            policyId: 0,
            registered: true
        });

        emit InsuranceEvents.DriverRegistered(msg.sender, driverId);
    }

    // ---------------------------------------------------------------
    //                        VIEW FUNCTIONS
    // ---------------------------------------------------------------

    /**
     * @notice Returns the on-chain driver record for a wallet.
     * @dev Reverts with `DriverNotRegistered` if the wallet never registered.
     * @param wallet The wallet address to look up.
     * @return driver The wallet's `InsuranceTypes.Driver` record.
     */
    function getDriver(address wallet) external view returns (InsuranceTypes.Driver memory driver) {
        if (!_drivers[wallet].registered) revert DriverNotRegistered(wallet);
        return _drivers[wallet];
    }

    /**
     * @notice Returns whether a wallet is registered as a driver.
     * @param wallet The wallet address to check.
     * @return registered True if the wallet has an associated driver record.
     */
    function isRegistered(address wallet) external view returns (bool registered) {
        return _drivers[wallet].registered;
    }

    // ---------------------------------------------------------------
    //              STATE WRITES — RESTRICTED TO TRUSTED CONTRACTS
    // ---------------------------------------------------------------

    /**
     * @notice Links a purchased policy ID to a driver's wallet.
     * @dev Restricted to POLICY_MANAGER_ROLE (the InsurancePolicy contract).
     *      Reverts with `DriverNotRegistered` if the wallet is not registered.
     * @param wallet The driver's wallet address.
     * @param policyId The policy ID to associate with this driver.
     */
    function linkPolicy(address wallet, uint256 policyId) external onlyRole(POLICY_MANAGER_ROLE) whenNotPaused {
        if (!_drivers[wallet].registered) revert DriverNotRegistered(wallet);
        _drivers[wallet].policyId = policyId;
    }

    // ---------------------------------------------------------------
    //                        EMERGENCY CONTROL
    // ---------------------------------------------------------------

    /// @notice Pauses all state-mutating functions on this contract.
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit InsuranceEvents.EmergencyPaused(msg.sender);
    }

    /// @notice Resumes normal operation after a pause.
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
        emit InsuranceEvents.EmergencyUnpaused(msg.sender);
    }
}
