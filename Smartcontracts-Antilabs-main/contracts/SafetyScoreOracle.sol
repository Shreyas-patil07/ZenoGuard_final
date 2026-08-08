// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {InsuranceEvents} from "./libraries/InsuranceEvents.sol";
import "./libraries/InsuranceErrors.sol";

/**
 * @title SafetyScoreOracle
 * @author Senior Solidity Architect
 * @notice Stores the latest AI-generated driver safety score, submitted by
 *         a trusted off-chain oracle backend. Performs NO score computation
 *         on-chain — it is a verified-value store, nothing more.
 * @dev Intentionally decoupled from DriverRegistry: this contract does not
 *      check whether an address is a registered driver before accepting a
 *      score. That validation belongs to whichever contract consumes the
 *      score (InsurancePolicy), keeping this oracle a simple, standalone,
 *      easily-swappable component — exactly the "store only the minimum
 *      verifiable state" scope requested.
 *
 *      Role model:
 *      - DEFAULT_ADMIN_ROLE: grants/revokes roles below; should be a
 *        multisig/timelock in production.
 *      - PAUSER_ROLE: may pause/unpause this contract in an emergency.
 *      - ORACLE_ROLE: held by the trusted off-chain oracle backend
 *        wallet(s); the only accounts permitted to submit scores.
 */
contract SafetyScoreOracle is AccessControl, Pausable {
    // ---------------------------------------------------------------
    //                             ROLES
    // ---------------------------------------------------------------

    /// @notice Allowed to pause/unpause this contract in an emergency.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Allowed to submit AI-generated safety scores. Held by the
    ///         off-chain oracle backend wallet(s).
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    // ---------------------------------------------------------------
    //                            STORAGE
    // ---------------------------------------------------------------

    /// @notice driver wallet => most recent verified safety score (0-100).
    /// @dev Public mapping auto-generates a `latestScore(address) view
    ///      returns (uint8)` getter, satisfying the "store only this
    ///      mapping" requirement without a redundant wrapper function.
    mapping(address => uint8) public latestScore;

    // ---------------------------------------------------------------
    //                          CONSTRUCTOR
    // ---------------------------------------------------------------

    /**
     * @param admin The address to receive DEFAULT_ADMIN_ROLE and PAUSER_ROLE.
     *              In production this should be a multisig or timelock.
     *              ORACLE_ROLE is granted separately by the admin after
     *              deployment, to the actual oracle backend address(es).
     */
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    // ---------------------------------------------------------------
    //                        SCORE SUBMISSION
    // ---------------------------------------------------------------

    /**
     * @notice Submits a new AI-generated safety score for a driver.
     * @dev Restricted to ORACLE_ROLE. Reverts with `InvalidSafetyScore` if
     *      `score` exceeds 100. Overwrites any previous score for `driver` —
     *      only the latest score is kept on-chain, consistent with the
     *      "minimum verifiable state" scope; full score history, if needed,
     *      is the backend's responsibility to log off-chain.
     * @param driver The driver wallet the score applies to.
     * @param score The new safety score, in the range 0-100.
     */
    function submitScore(address driver, uint8 score) external onlyRole(ORACLE_ROLE) whenNotPaused {
        if (driver == address(0)) revert ZeroAddress();
        if (score > 100) revert InvalidSafetyScore(score);

        latestScore[driver] = score;

        emit InsuranceEvents.SafetyScoreUpdated(driver, score);
    }

    // ---------------------------------------------------------------
    //                        EMERGENCY CONTROL
    // ---------------------------------------------------------------

    /// @notice Pauses score submission on this contract.
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
