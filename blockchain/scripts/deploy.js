// SPDX-License-Identifier: MIT
/**
 * Deploys the complete ZenoGuard insurance contract graph and wires the
 * inter-contract roles required for policy creation and claim settlement.
 *
 * Usage:
 *   npx hardhat run scripts/deploy.js --network sepolia
 *
 * Environment variables:
 *   ADMIN_ADDRESS               Optional admin address. Defaults to deployer.
 *   ORACLE_ADDRESS              Optional backend wallet for oracle operations.
 *   INSURANCE_COMPANY_ADDRESS   Optional backend wallet for insurer operations.
 */

import hre from "hardhat";
import "dotenv/config";

async function main() {
  const { ethers } = await hre.network.create();
  const [deployer] = await ethers.getSigners();

  console.log("Deploying with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH"
  );

  const ADMIN = process.env.ADMIN_ADDRESS || deployer.address;
  const ORACLE_BACKEND = process.env.ORACLE_ADDRESS;
  const INSURER_BACKEND = process.env.INSURANCE_COMPANY_ADDRESS;

  if (ADMIN !== deployer.address) {
    throw new Error(
      "ADMIN_ADDRESS must equal the deployer for this deployment script. " +
      "Use a separate multisig/admin wiring transaction if you need a different admin."
    );
  }

  console.log("Admin address:", ADMIN);

  const DriverRegistry = await ethers.getContractFactory("DriverRegistry");
  const driverRegistry = await DriverRegistry.deploy(ADMIN);
  await driverRegistry.waitForDeployment();
  console.log("DriverRegistry:", await driverRegistry.getAddress());

  const SafetyScoreOracle = await ethers.getContractFactory("SafetyScoreOracle");
  const safetyScoreOracle = await SafetyScoreOracle.deploy(ADMIN);
  await safetyScoreOracle.waitForDeployment();
  console.log("SafetyScoreOracle:", await safetyScoreOracle.getAddress());

  const InsurancePool = await ethers.getContractFactory("InsurancePool");
  const insurancePool = await InsurancePool.deploy(ADMIN);
  await insurancePool.waitForDeployment();
  console.log("InsurancePool:", await insurancePool.getAddress());

  const InsurancePolicy = await ethers.getContractFactory("InsurancePolicy");
  const insurancePolicy = await InsurancePolicy.deploy(
    ADMIN,
    await driverRegistry.getAddress(),
    await safetyScoreOracle.getAddress(),
    await insurancePool.getAddress()
  );
  await insurancePolicy.waitForDeployment();
  console.log("InsurancePolicy:", await insurancePolicy.getAddress());

  const ClaimManager = await ethers.getContractFactory("ClaimManager");
  const claimManager = await ClaimManager.deploy(
    ADMIN,
    await insurancePolicy.getAddress(),
    await insurancePool.getAddress()
  );
  await claimManager.waitForDeployment();
  console.log("ClaimManager:", await claimManager.getAddress());

  console.log("Wiring inter-contract roles...");

  const policyManagerRole = await driverRegistry.POLICY_MANAGER_ROLE();
  await (
    await driverRegistry.grantRole(
      policyManagerRole,
      await insurancePolicy.getAddress()
    )
  ).wait();

  const spenderRole = await insurancePool.SPENDER_ROLE();
  await (
    await insurancePool.grantRole(spenderRole, await claimManager.getAddress())
  ).wait();

  if (ORACLE_BACKEND) {
    await (
      await safetyScoreOracle.grantRole(
        await safetyScoreOracle.ORACLE_ROLE(),
        ORACLE_BACKEND
      )
    ).wait();

    await (
      await claimManager.grantRole(
        await claimManager.ORACLE_ROLE(),
        ORACLE_BACKEND
      )
    ).wait();

    console.log("ORACLE_ROLE granted to:", ORACLE_BACKEND);
  } else {
    console.log("ORACLE_ROLE skipped: ORACLE_ADDRESS not set");
  }

  if (INSURER_BACKEND) {
    await (
      await insurancePolicy.grantRole(
        await insurancePolicy.INSURANCE_COMPANY_ROLE(),
        INSURER_BACKEND
      )
    ).wait();

    await (
      await claimManager.grantRole(
        await claimManager.INSURANCE_COMPANY_ROLE(),
        INSURER_BACKEND
      )
    ).wait();

    await (
      await insurancePool.grantRole(
        await insurancePool.INSURANCE_COMPANY_ROLE(),
        INSURER_BACKEND
      )
    ).wait();

    console.log("INSURANCE_COMPANY_ROLE granted to:", INSURER_BACKEND);
  } else {
    console.log(
      "INSURANCE_COMPANY_ROLE skipped: INSURANCE_COMPANY_ADDRESS not set"
    );
  }

  console.log("\nDeployment complete.");
  console.log("DriverRegistry:   ", await driverRegistry.getAddress());
  console.log("SafetyScoreOracle:", await safetyScoreOracle.getAddress());
  console.log("InsurancePool:    ", await insurancePool.getAddress());
  console.log("InsurancePolicy:  ", await insurancePolicy.getAddress());
  console.log("ClaimManager:     ", await claimManager.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
