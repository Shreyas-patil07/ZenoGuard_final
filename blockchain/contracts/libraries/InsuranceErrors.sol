// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

error ZeroAddress();
error ZeroAmount();
error DriverAlreadyRegistered(address wallet);
error DriverNotRegistered(address wallet);
error PolicyAlreadyActive(address driver);
error PolicyNotFound(uint256 policyId);
error PolicyNotActive(uint256 policyId);
error PolicyExpired(uint256 policyId, uint64 expiryTime);
error IncorrectPremiumAmount(uint256 required, uint256 sent);
error NotPolicyOwner(address caller, uint256 policyId);
error PolicyUnderReview(uint256 policyId);
error InvalidDuration(uint64 durationSeconds);
error InvalidSafetyScore(uint8 score);
error ClaimNotFound(uint256 claimId);
error ClaimAlreadyPending(uint256 policyId, uint256 pendingClaimId);
error InvalidClaimState(uint256 claimId);
error AccidentNotVerified(uint256 claimId);
error DuplicatePayout(uint256 claimId);
error ClaimExceedsCoverage(uint256 requested, uint256 coverage);
error InsufficientPoolBalance(uint256 requested, uint256 available);
error TransferFailed(address to, uint256 amount);
