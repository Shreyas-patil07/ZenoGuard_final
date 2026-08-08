// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title InsuranceEvents
 * @author Senior Solidity Architect
 * @notice Centralized event definitions for the lean Driver Insurance protocol.
 * @dev Events declared inside a library can be emitted directly by any
 *      contract that imports it, via `InsuranceEvents.EventName(...)` — one
 *      canonical definition instead of duplicating identical events across
 *      DriverRegistry, InsurancePolicy, ClaimManager, and InsurancePool.
 */
library InsuranceEvents {
    /// @notice Emitted when a new driver registers with the platform.
    /// @param wallet The driver's wallet address.
    /// @param driverId The off-chain-assigned driver identifier.
    event DriverRegistered(address indexed wallet, bytes32 driverId);

    /// @notice Emitted when a driver purchases a new insurance policy.
    /// @param policyId The newly created policy ID.
    /// @param driver The driver the policy belongs to.
    /// @param premium The premium paid, in wei.
    /// @param coverage The maximum payout coverage, in wei.
    /// @param expiryTime The unix timestamp the policy expires.
    event PolicyPurchased(
        uint256 indexed policyId,
        address indexed driver,
        uint256 premium,
        uint256 coverage,
        uint64 expiryTime
    );

    /// @notice Emitted when a policy is renewed.
    /// @param policyId The renewed policy ID.
    /// @param newPremium The updated premium, in wei.
    /// @param newExpiryTime The new expiry timestamp.
    event PolicyRenewed(uint256 indexed policyId, uint256 newPremium, uint64 newExpiryTime);

    /// @notice Emitted when a policy is cancelled by the driver or the insurer.
    /// @param policyId The cancelled policy ID.
    /// @param cancelledBy The address that initiated the cancellation.
    event PolicyCancelled(uint256 indexed policyId, address indexed cancelledBy);

    /// @notice Emitted whenever a policy's premium amount is recalculated or updated.
    /// @param policyId The affected policy ID.
    /// @param oldPremium The previous premium, in wei.
    /// @param newPremium The new premium, in wei.
    event PremiumUpdated(uint256 indexed policyId, uint256 oldPremium, uint256 newPremium);

    /// @notice Emitted when the oracle submits an updated safety score for a driver.
    /// @param driver The driver wallet whose score was updated.
    /// @param newScore The new safety score (0-100).
    event SafetyScoreUpdated(address indexed driver, uint8 newScore);

    /// @notice Emitted when a driver submits a new claim.
    /// @param claimId The newly created claim ID.
    /// @param policyId The policy the claim is filed against.
    /// @param amount The amount requested, in wei.
    event ClaimSubmitted(uint256 indexed claimId, uint256 indexed policyId, uint256 amount);

    /// @notice Emitted when the insurance company approves a claim for payout.
    /// @param claimId The approved claim ID.
    /// @param approvedBy The insurance-company address that approved it.
    event ClaimApproved(uint256 indexed claimId, address indexed approvedBy);

    /// @notice Emitted when a claim is rejected.
    /// @param claimId The rejected claim ID.
    /// @param reason A short human-readable reason.
    /// @param rejectedBy The address that rejected the claim.
    event ClaimRejected(uint256 indexed claimId, string reason, address indexed rejectedBy);

    /// @notice Emitted when a claim payout has been successfully transferred to the driver.
    /// @param claimId The paid claim ID.
    /// @param driver The recipient driver wallet.
    /// @param amount The amount paid out, in wei.
    event PayoutCompleted(uint256 indexed claimId, address indexed driver, uint256 amount);

    /// @notice Emitted when funds are deposited into the InsurancePool.
    /// @param depositor The address that deposited funds.
    /// @param amount The amount deposited, in wei.
    event FundsDeposited(address indexed depositor, uint256 amount);

    /// @notice Emitted when a contract is paused in response to an emergency.
    /// @param pausedBy The address that triggered the pause.
    event EmergencyPaused(address indexed pausedBy);

    /// @notice Emitted when a contract is unpaused, resuming normal operations.
    /// @param unpausedBy The address that lifted the pause.
    event EmergencyUnpaused(address indexed unpausedBy);
}
