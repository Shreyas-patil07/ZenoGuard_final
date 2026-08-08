// SPDX-License-Identifier: MIT
/**
 * @file scripts/deploy.js
 * @notice Deploys the full Driver Insurance contract graph and wires up the
 *         inter-contract roles required for the system to function:
 *
 *           1. DriverRegistry
 *           2. SafetyScoreOracle
 *           3. InsurancePool
 *           4. InsurancePolicy   (depends on 1, 2, 3)
 *           5. ClaimManager      (depends on 4, 3)
 *
 *         Then grants:
 *           - POLICY_MANAGER_ROLE on DriverRegistry  -> InsurancePolicy address
 *           - SPENDER_ROLE        on InsurancePool   -> ClaimManager address
 *           - ORACLE_ROLE / INSURANCE_COMPANY_ROLE   -> off-chain backend
 *             addresses, if provided via environment variables.
 *
 * @dev Usage:
 *   npx hardhat run scripts/deploy.js --network sepolia
 *
 * Environment variables (all optional; sensible defaults are used):
 *   ADMIN_ADDRESS               - receives DEFAULT_ADMIN_ROLE + PAUSER_ROLE
 *                                  on every contract. Defaults to the
 *                                  deployer. Use a multisig/timelock address
 *                                  in production, not an EOA.
 *   ORACLE_ADDRESS               - off-chain oracle backend wallet; granted
 *                                  ORACLE_ROLE on SafetyScoreOracle and
 *                                  ClaimManager. Skipped if unset.
 *   INSURANCE_COMPANY_ADDRESS    - insurer backend/ops wallet; granted
 *                                  INSURANCE_COMPANY_ROLE on InsurancePolicy,
 *                                  ClaimManager, and InsurancePool. Skipped
 *                                  if unset.
 *
 * Requires hardhat.config.js to have a `sepolia` network configured with an
 * RPC URL and a funded deployer private key (e.g. via dotenv + .env file):
 *
 *   networks: {
 *     sepolia: {
 *       url: process.env.SEPOLIA_RPC_URL,
 *       accounts: [process.env.DEPLOYER_PRIVATE_KEY],
 *     },
 *   },
 */

const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const ADMIN = process.env.ADMIN_ADDRESS || deployer.address;
  const ORACLE_BACKEND = process.env.ORACLE_ADDRESS;
  const INSURER_BACKEND = process.env.INSURANCE_COMPANY_ADDRESS;

  console.log("\nAdmin address:", ADMIN);
  if (ADMIN === deployer.address) {
    console.log("  (using deployer as admin — replace with a multisig/timelock for production)");
  }

  // -----------------------------------------------------------------
  // 1. DriverRegistry
  // -----------------------------------------------------------------
  const DriverRegistry = await ethers.getContractFactory("DriverRegistry");
  const driverRegistry = await DriverRegistry.deploy(ADMIN);
  await driverRegistry.waitForDeployment();
  console.log("\nDriverRegistry deployed to:", await driverRegistry.getAddress());

  // -----------------------------------------------------------------
  // 2. SafetyScoreOracle
  // -----------------------------------------------------------------
  const SafetyScoreOracle = await ethers.getContractFactory("SafetyScoreOracle");
  const safetyScoreOracle = await SafetyScoreOracle.deploy(ADMIN);
  await safetyScoreOracle.waitForDeployment();
  console.log("SafetyScoreOracle deployed to:", await safetyScoreOracle.getAddress());

  // -----------------------------------------------------------------
  // 3. InsurancePool
  // -----------------------------------------------------------------
  const InsurancePool = await ethers.getContractFactory("InsurancePool");
  const insurancePool = await InsurancePool.deploy(ADMIN);
  await insurancePool.waitForDeployment();
  console.log("InsurancePool deployed to:", await insurancePool.getAddress());

  // -----------------------------------------------------------------
  // 4. InsurancePolicy
  // -----------------------------------------------------------------
  const InsurancePolicy = await ethers.getContractFactory("InsurancePolicy");
  const insurancePolicy = await InsurancePolicy.deploy(
    ADMIN,
    await driverRegistry.getAddress(),
    await safetyScoreOracle.getAddress(),
    await insurancePool.getAddress()
  );
  await insurancePolicy.waitForDeployment();
  console.log("InsurancePolicy deployed to:", await insurancePolicy.getAddress());

  // -----------------------------------------------------------------
  // 5. ClaimManager
  // -----------------------------------------------------------------
  const ClaimManager = await ethers.getContractFactory("ClaimManager");
  const claimManager = await ClaimManager.deploy(
    ADMIN,
    await insurancePolicy.getAddress(),
    await insurancePool.getAddress()
  );
  await claimManager.waitForDeployment();
  console.log("ClaimManager deployed to:", await claimManager.getAddress());

  // -----------------------------------------------------------------
  // Wire up inter-contract roles
  // -----------------------------------------------------------------
  console.log("\nWiring inter-contract roles...");

  // Only the deployer key is available as a signer here unless ADMIN was
  // left as the deployer; if you passed a separate multisig ADMIN_ADDRESS,
  // run these grantRole calls separately from that multisig instead.
  const adminSigner = deployer;

  const POLICY_MANAGER_ROLE = await driverRegistry.POLICY_MANAGER_ROLE();
  await (
    await driverRegistry.connect(adminSigner).grantRole(POLICY_MANAGER_ROLE, await insurancePolicy.getAddress())
  ).wait();
  console.log("  Granted POLICY_MANAGER_ROLE on DriverRegistry -> InsurancePolicy");

  const SPENDER_ROLE = await insurancePool.SPENDER_ROLE();
  await (await insurancePool.connect(adminSigner).grantRole(SPENDER_ROLE, await claimManager.getAddress())).wait();
  console.log("  Granted SPENDER_ROLE on InsurancePool -> ClaimManager");

  // -----------------------------------------------------------------
  // Grant operational roles to off-chain backend addresses (optional)
  // -----------------------------------------------------------------
  if (ORACLE_BACKEND) {
    await (
      await safetyScoreOracle.connect(adminSigner).grantRole(await safetyScoreOracle.ORACLE_ROLE(), ORACLE_BACKEND)
    ).wait();
    await (await claimManager.connect(adminSigner).grantRole(await claimManager.ORACLE_ROLE(), ORACLE_BACKEND)).wait();
    console.log("  Granted ORACLE_ROLE ->", ORACLE_BACKEND, "(SafetyScoreOracle + ClaimManager)");
  } else {
    console.log("  Skipped ORACLE_ROLE grant — set ORACLE_ADDRESS env var to assign it");
  }

  if (INSURER_BACKEND) {
    await (
      await insurancePolicy.connect(adminSigner).grantRole(await insurancePolicy.INSURANCE_COMPANY_ROLE(), INSURER_BACKEND)
    ).wait();
    await (
      await claimManager.connect(adminSigner).grantRole(await claimManager.INSURANCE_COMPANY_ROLE(), INSURER_BACKEND)
    ).wait();
    await (
      await insurancePool.connect(adminSigner).grantRole(await insurancePool.INSURANCE_COMPANY_ROLE(), INSURER_BACKEND)
    ).wait();
    console.log(
      "  Granted INSURANCE_COMPANY_ROLE ->",
      INSURER_BACKEND,
      "(InsurancePolicy + ClaimManager + InsurancePool)"
    );
  } else {
    console.log("  Skipped INSURANCE_COMPANY_ROLE grant — set INSURANCE_COMPANY_ADDRESS env var to assign it");
  }

  // -----------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------
  console.log("\nDeployment complete.\n");
  console.log("Contract addresses:");
  console.log("  DriverRegistry:    ", await driverRegistry.getAddress());
  console.log("  SafetyScoreOracle: ", await safetyScoreOracle.getAddress());
  console.log("  InsurancePool:     ", await insurancePool.getAddress());
  console.log("  InsurancePolicy:   ", await insurancePolicy.getAddress());
  console.log("  ClaimManager:      ", await claimManager.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
