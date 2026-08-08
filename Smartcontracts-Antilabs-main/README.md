# AI-Powered Insurance Smart Contracts (Ethereum)

A decentralized insurance platform built on **Ethereum** that enables **AI-assisted claim verification and automatic blockchain payouts**. The project demonstrates how smart contracts can replace manual insurance processing with transparent, tamper-proof, and programmable logic.

## Overview

Traditional insurance claims often involve paperwork, manual verification, delays, and opaque decision-making. This project uses **Solidity smart contracts** to manage driver registration, insurance policies, claim processing, and automated payouts through an on-chain insurance pool.

The architecture is designed for a future workflow where an **AI safety-score engine / accident verification oracle** can verify incidents and trigger claim approvals automatically.

## Features

* Driver registration and identity management
* Insurance policy creation and activation
* Decentralized insurance pool for premium collection and payouts
* Claim submission and lifecycle management
* AI/Oracle-ready accident verification flow
* Event-based on-chain transparency
* Custom Solidity errors for gas-efficient validation
* Modular contract architecture for easy extension

## Smart Contract Architecture

### Core Contracts

* **DriverRegistry.sol** – Registers drivers and stores driver-related data.
* **InsurancePolicy.sol** – Creates and manages insurance policies.
* **ClaimManager.sol** – Handles claim submission, approval, rejection, and payout requests.
* **InsurancePool.sol** – Holds pooled insurance funds and executes payouts.
* **SafetyScoreOracle.sol** – Oracle interface for AI-generated safety scores and accident verification.

### Shared Libraries

* **InsuranceTypes.sol** – Shared structs and enums.
* **InsuranceEvents.sol** – Centralized event definitions.
* **InsuranceErrors.sol** – Custom error definitions used across contracts.

## Project Structure

```text
contracts/
├── DriverRegistry.sol
├── InsurancePolicy.sol
├── ClaimManager.sol
├── InsurancePool.sol
├── SafetyScoreOracle.sol
└── libraries/
    ├── InsuranceTypes.sol
    ├── InsuranceEvents.sol
    └── InsuranceErrors.sol
```

## Workflow

1. **Register Driver**
2. **Create Insurance Policy**
3. **Pay Premium into Insurance Pool**
4. **Submit Claim**
5. **AI / Oracle Verifies Accident**
6. **Claim Approved**
7. **Automatic On-Chain Payout**

## Technology Stack

* **Solidity**
* **Ethereum Virtual Machine (EVM)**
* **Remix IDE**
* **OpenZeppelin-compatible architecture**
* **Git & GitHub**

## Deployment

The contracts can be deployed using **Remix IDE** on:

* Remix VM (local testing)
* Sepolia Testnet
* Ethereum Mainnet (with appropriate configuration)

### Recommended Deployment Order

1. DriverRegistry
2. InsurancePool
3. InsurancePolicy
4. ClaimManager
5. SafetyScoreOracle

## Testing

The contracts were manually tested in Remix by simulating:

* Driver registration
* Policy creation
* Insurance pool funding
* Claim submission
* Oracle verification
* Claim approval
* Automatic payout execution

## Future Enhancements

* Integration with a real AI driving-risk model
* Chainlink oracle support
* ERC20 premium payments
* Multi-insurer liquidity pools
* Dynamic premium calculation based on driving behavior
* DAO-based claim governance
* Mobile/Web3 frontend integration

## License

This project is released under the **MIT License**.

## Author

**Rijul Singh**

Built as part of a blockchain/AI insurance automation project demonstrating decentralized claim processing and automated smart contract payouts on Ethereum.
