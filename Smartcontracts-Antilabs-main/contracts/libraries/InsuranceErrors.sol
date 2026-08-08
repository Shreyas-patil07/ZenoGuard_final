// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title InsuranceErrors
 * @author Senior Solidity Architect
 * @notice Centralized, file-level custom errors shared across the lean
 *         Driver Insurance protocol contracts.
 * @dev Declared at file scope (not inside a library/contract) so any
 *      contract can `import` this file and `revert ErrorName(...)` directly.
 *      Custom errors are cheaper than `require(cond, "string")` — a 4-byte
 *      selector + ABI-encoded args instead of a string in bytecode/returndata.
 */

// ---------------------------------------------------------------------
//                      ACCESS CONTROL / GENERAL
// ---------------------------------------------------------------------

/// @notice Thrown when a zero address is passed where a non-zero address is required.
error ZeroAddress();

/// @notice Thrown when a numeric argument is zero but must be non-zero.
error ZeroAmount();

// ---------------------------------------------------------------------
//                          DRIVER REGISTRY
// ---------------------------------------------------------------------

/// @notice Thrown when trying to register a wallet that is already registered.
/// @param wallet The wallet address already on record.
error DriverAlreadyRegistered(address wallet);

/// @notice Thrown when referencing a wallet that has not registered as a driver.
/// @param wallet The unrecognized wallet address.
error DriverNotRegistered(address wallet);

// ---------------------------------------------------------------------
//                          INSURANCE POLICY
// ---------------------------------------------------------------------

/// @notice Thrown when a driver already holds an active policy and tries to purchase another.
/// @param driver The driver wallet with an existing active policy.
error PolicyAlreadyActive(address driver);

/// @notice Thrown when referencing a policy ID that does not exist.
/// @param policyId The unrecognized policy ID.
error PolicyNotFound(uint256 policyId);

/// @notice Thrown when an action requires an active policy but the policy is not active.
/// @param policyId The policy ID in question.
error PolicyNotActive(uint256 policyId);

/// @notice Thrown when an action is attempted on a policy that has expired.
/// @param policyId The expired policy ID.
/// @param expiryTime The timestamp at which the policy expired.
error PolicyExpired(uint256 policyId, uint64 expiryTime);

/// @notice Thrown when the value sent does not match the required premium amount.
/// @param required The expected premium amount in wei.
/// @param sent The amount actually sent in wei.
error IncorrectPremiumAmount(uint256 required, uint256 sent);

/// @notice Thrown when a caller other than the policy's driver attempts a driver-only action.
/// @param caller The address that attempted the action.
/// @param policyId The policy ID they attempted to act on.
error NotPolicyOwner(address caller, uint256 policyId);

/// @notice Thrown when a policy is flagged under review (safety score < 60) and the
///         attempted action requires the policy to be in good standing.
/// @param policyId The policy ID under review.
error PolicyUnderReview(uint256 policyId);

// ---------------------------------------------------------------------
//                        SAFETY SCORE ORACLE
// ---------------------------------------------------------------------

/// @notice Thrown when a submitted safety score is outside the valid 0-100 range.
/// @param score The invalid score that was submitted.
error InvalidSafetyScore(uint8 score);

// ---------------------------------------------------------------------
//                           CLAIM MANAGER
// ---------------------------------------------------------------------

/// @notice Thrown when referencing a claim ID that does not exist.
/// @param claimId The unrecognized claim ID.
error ClaimNotFound(uint256 claimId);

/// @notice Thrown when a driver attempts to submit a new claim while a prior
///         claim on the same policy is still pending resolution.
/// @param policyId The policy ID with a pending claim.
/// @param pendingClaimId The claim ID that is still pending.
error ClaimAlreadyPending(uint256 policyId, uint256 pendingClaimId);

/// @notice Thrown when attempting to verify an accident for a claim that was
///         already verified, or approve/pay a claim not yet in the required state.
/// @param claimId The claim ID.
error InvalidClaimState(uint256 claimId);

/// @notice Thrown when attempting to approve or pay out a claim whose accident
///         has not yet been verified by the oracle.
/// @param claimId The claim ID.
error AccidentNotVerified(uint256 claimId);

/// @notice Thrown when attempting to pay out a claim that has already been paid.
/// @param claimId The claim ID already paid.
error DuplicatePayout(uint256 claimId);

/// @notice Thrown when a claim's requested amount exceeds the policy's coverage amount.
/// @param requested The requested claim amount.
/// @param coverage The policy's maximum coverage amount.
error ClaimExceedsCoverage(uint256 requested, uint256 coverage);

// ---------------------------------------------------------------------
//                          INSURANCE POOL
// ---------------------------------------------------------------------

/// @notice Thrown when the pool's available balance is insufficient to cover a payout.
/// @param requested The requested payout amount.
/// @param available The pool's current available balance.
error InsufficientPoolBalance(uint256 requested, uint256 available);

/// @notice Thrown when a native-token transfer (ETH) fails.
/// @param to The intended recipient.
/// @param amount The amount that failed to transfer.
error TransferFailed(address to, uint256 amount);
