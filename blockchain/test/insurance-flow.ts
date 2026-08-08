import assert from "node:assert/strict";
import hre from "hardhat";

describe("ZenoGuard insurance flow", function () {
  it("registers a driver, purchases a policy, verifies a claim, and pays out", async function () {
    const { ethers } = await hre.network.create();
    const [admin, driver] = await ethers.getSigners();

    const DriverRegistry = await ethers.getContractFactory("DriverRegistry");
    const driverRegistry = await DriverRegistry.deploy(admin.address);
    await driverRegistry.waitForDeployment();

    const SafetyScoreOracle = await ethers.getContractFactory("SafetyScoreOracle");
    const safetyScoreOracle = await SafetyScoreOracle.deploy(admin.address);
    await safetyScoreOracle.waitForDeployment();

    const InsurancePool = await ethers.getContractFactory("InsurancePool");
    const insurancePool = await InsurancePool.deploy(admin.address);
    await insurancePool.waitForDeployment();

    const InsurancePolicy = await ethers.getContractFactory("InsurancePolicy");
    const insurancePolicy = await InsurancePolicy.deploy(
      admin.address,
      await driverRegistry.getAddress(),
      await safetyScoreOracle.getAddress(),
      await insurancePool.getAddress()
    );
    await insurancePolicy.waitForDeployment();

    const ClaimManager = await ethers.getContractFactory("ClaimManager");
    const claimManager = await ClaimManager.deploy(
      admin.address,
      await insurancePolicy.getAddress(),
      await insurancePool.getAddress()
    );
    await claimManager.waitForDeployment();

    const policyManagerRole = await driverRegistry.POLICY_MANAGER_ROLE();
    await driverRegistry.grantRole(policyManagerRole, await insurancePolicy.getAddress());

    const spenderRole = await insurancePool.SPENDER_ROLE();
    await insurancePool.grantRole(spenderRole, await claimManager.getAddress());

    const oracleRole = await safetyScoreOracle.ORACLE_ROLE();
    await safetyScoreOracle.grantRole(oracleRole, admin.address);
    await claimManager.grantRole(await claimManager.ORACLE_ROLE(), admin.address);

    const insurerRole = await insurancePolicy.INSURANCE_COMPANY_ROLE();
    await insurancePolicy.grantRole(insurerRole, admin.address);
    await claimManager.grantRole(await claimManager.INSURANCE_COMPANY_ROLE(), admin.address);

    const driverId = ethers.keccak256(ethers.toUtf8Bytes("zenoguard-test-driver"));
    await driverRegistry.connect(driver).registerDriver(driverId);

    assert.equal(await driverRegistry.isRegistered(driver.address), true);

    await safetyScoreOracle.submitScore(driver.address, 90);
    assert.equal(await safetyScoreOracle.latestScore(driver.address), 90);

    const basePremium = ethers.parseEther("0.1");
    const expectedPremium = ethers.parseEther("0.08");
    const coverage = ethers.parseEther("0.5");

    const purchaseTx = await insurancePolicy
      .connect(driver)
      .purchasePolicy(basePremium, coverage, { value: expectedPremium });
    await purchaseTx.wait();

    const policy = await insurancePolicy.getPolicy(1);
    assert.equal(policy.driver, driver.address);
    assert.equal(policy.premium, expectedPremium);
    assert.equal(policy.coverage, coverage);
    assert.equal(policy.active, true);

    await insurancePool.deposit({ value: ethers.parseEther("1") });

    const claimTx = await claimManager.connect(driver).submitClaim(1, coverage);
    await claimTx.wait();

    const claimBefore = await claimManager.getClaim(1);
    assert.equal(claimBefore.submitted, true);
    assert.equal(claimBefore.accidentVerified, false);
    assert.equal(claimBefore.paid, false);

    await claimManager.verifyAccident(1, true);

    const claimVerified = await claimManager.getClaim(1);
    assert.equal(claimVerified.accidentVerified, true);

    const balanceBefore = await ethers.provider.getBalance(driver.address);
    await claimManager.approveClaim(1);

    const claimAfter = await claimManager.getClaim(1);
    assert.equal(claimAfter.approved, true);
    assert.equal(claimAfter.paid, true);

    const balanceAfter = await ethers.provider.getBalance(driver.address);
    assert.equal(balanceAfter - balanceBefore, coverage);

    assert.equal(await insurancePool.getPoolBalance(), ethers.parseEther("0.58"));
  });
});
