// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {InsuranceEvents} from "./libraries/InsuranceEvents.sol";
import "./libraries/InsuranceErrors.sol";

/**
 * @title InsurancePool
 * @author Senior Solidity Architect
 * @notice Minimal treasury contract: holds ETH collected from premiums and
 *         insurer top-ups, and pays out approved claims. Added beyond the
 *         original four-contract list because ClaimManager's "automatic
 *         payout transfer" requirement needs funds to live somewhere on-chain
 *         — this contract is intentionally as small as possible: no policy
 *         logic, no claim logic, just custody and controlled disbursement.
 * @dev Role model:
 *      - DEFAULT_ADMIN_ROLE: grants/revokes roles below; multisig/timelock
 *        in production.
 *      - PAUSER_ROLE: may pause/unpause deposits and payouts in an emergency.
 *      - SPENDER_ROLE: granted exclusively to the deployed ClaimManager
 *        contract address, allowing it (and only it) to trigger payouts.
 *      - INSURANCE_COMPANY_ROLE: may fund the pool directly (though anyone
 *        can technically call `deposit`; this role exists for clarity and
 *        matches the top-level spec's "Fund payouts" responsibility).
 */
contract InsurancePool is AccessControl, Pausable, ReentrancyGuard {
    // ---------------------------------------------------------------
    //                             ROLES
    // ---------------------------------------------------------------

    /// @notice Allowed to pause/unpause this contract in an emergency.
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @notice Granted exclusively to the ClaimManager contract address,
    ///         allowing it to trigger payouts from pool funds.
    bytes32 public constant SPENDER_ROLE = keccak256("SPENDER_ROLE");

    /// @notice May deposit funds into the pool (also open to any depositor
    ///         via `deposit`, e.g. InsurancePolicy forwarding premiums).
    bytes32 public constant INSURANCE_COMPANY_ROLE = keccak256("INSURANCE_COMPANY_ROLE");

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
    //                            DEPOSITS
    // ---------------------------------------------------------------

    /**
     * @notice Deposits native ETH into the pool.
     * @dev Open to any caller — used both for insurer top-ups
     *      (INSURANCE_COMPANY_ROLE holders) and for InsurancePolicy
     *      forwarding collected premiums. Reverts with `ZeroAmount` if no
     *      ETH is attached.
     */
    function deposit() external payable whenNotPaused {
        if (msg.value == 0) revert ZeroAmount();
        emit InsuranceEvents.FundsDeposited(msg.sender, msg.value);
    }

    /// @dev Allows the pool to receive plain ETH transfers (e.g. `send`/`transfer`)
    ///      as an additional funding path, treated identically to `deposit()`.
    receive() external payable {
        if (msg.value == 0) revert ZeroAmount();
        emit InsuranceEvents.FundsDeposited(msg.sender, msg.value);
    }

    // ---------------------------------------------------------------
    //                            PAYOUTS
    // ---------------------------------------------------------------

    /**
     * @notice Pays out an approved claim amount to a driver's wallet.
     * @dev Restricted to SPENDER_ROLE (the ClaimManager contract).
     *      Follows checks-effects-interactions: the balance check happens
     *      before the external call, and `nonReentrant` guards against
     *      reentrancy during the ETH transfer. Reverts with
     *      `InsufficientPoolBalance` if funds are short, and
     *      `TransferFailed` if the low-level call fails.
     * @param to The driver wallet receiving the payout.
     * @param amount The amount to pay out, in wei.
     * @return success True if the payout transfer succeeded.
     */
    function payOut(
        address payable to,
        uint256 amount
    ) external onlyRole(SPENDER_ROLE) whenNotPaused nonReentrant returns (bool success) {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount > address(this).balance) revert InsufficientPoolBalance(amount, address(this).balance);

        (bool sent, ) = to.call{value: amount}("");
        if (!sent) revert TransferFailed(to, amount);

        return true;
    }

    // ---------------------------------------------------------------
    //                        VIEW FUNCTIONS
    // ---------------------------------------------------------------

    /// @notice Returns the pool's current ETH balance.
    /// @return balance The pool's balance, in wei.
    function getPoolBalance() external view returns (uint256 balance) {
        return address(this).balance;
    }

    // ---------------------------------------------------------------
    //                        EMERGENCY CONTROL
    // ---------------------------------------------------------------

    /// @notice Pauses deposits and payouts on this contract.
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
