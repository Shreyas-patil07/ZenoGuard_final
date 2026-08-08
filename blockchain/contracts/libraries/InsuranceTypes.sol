// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title InsuranceTypes
 * @author Senior Solidity Architect
 * @notice Minimal, shared struct definitions for the Driver Insurance
 *         protocol. Only the fields strictly required for trustless
 *         on-chain insurance logic live here — everything else (trip
 *         history, AI inputs, documents, telemetry, driver profiles) is
 *         intentionally kept off-chain in the backend, per project scope.
 * @dev Pure type definitions only: no storage, no functions, no external
 *      calls. Imported by every contract so all modules agree on layout.
 */
library InsuranceTypes {
    /**
     * @notice Minimal on-chain driver identity record.
     * @dev `driverId` is a bytes32 handle (e.g. keccak256 of an off-chain
     *      UUID or backend record ID) rather than a sequential uint256 —
     *      this lets the backend mint IDs however it likes without the
     *      chain needing to be the source of ID generation.
     */
    struct Driver {
        address wallet;
        bytes32 driverId;
        uint256 policyId;
        bool registered;
    }

    /**
     * @notice Minimal on-chain insurance policy record.
     * @dev `underReview` is a small necessary addition beyond the literal
     *      spec list: the premium-logic requirement ("Below 60: Mark policy
     *      for review") needs somewhere durable to persist that state so
     *      ClaimManager can block claims on policies pending review. It costs
     *      one extra bit, packed into the same slot as `active` (both are
     *      bool, 1 byte each) — zero extra storage slots.
     */
    struct Policy {
        uint256 id;
        address driver;
        uint256 premium;
        uint256 coverage;
        uint64 startTime;
        uint64 expiryTime;
        bool active;
        bool underReview;
    }

    /**
     * @notice Minimal on-chain insurance claim record.
     */
    struct Claim {
        uint256 id;
        uint256 policyId;
        uint256 amount;
        bool submitted;
        bool accidentVerified;
        bool approved;
        bool paid;
    }
}
