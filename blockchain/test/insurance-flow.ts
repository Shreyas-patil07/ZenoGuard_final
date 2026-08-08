import assert from "node:assert/strict";
import hre from "hardhat";

describe("ZenoGuard insurance flow", function () {
  it("registers a driver, purchases a 30-day policy, verifies a claim, and pays out", async function () {
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

    await driverRegistry.grantRole(
      await driverRegistry.POLICY_MANAGER_ROLE(),
      await insurancePolicy.getAddress()
    );
    await insurancePool.grantRole(
      await insurancePool.SPENDER_ROLE(),
      await claimManager.getAddress()
    );
    await claimManager.grantRole(await claimManager.ORACLE_ROLE(), admin.address);
    await claimManager.grantRole(await claimManager.INSURANCE_COMPANY_ROLE(), admin.address);

    const driverId = ethers.keccak256(ethers.toUtf8Bytes("zenoguard-test-driver"));
    await driverRegistry.connect(driver).registerDriver(driverId);
    assert.equal(await driverRegistry.isRegistered(driver.address), true);

    const premium = ethers.parseEther("0.08");
    const coverage = ethers.parseEther("0.5");
    const duration = await insurancePolicy.DURATION_30_DAYS();

    await insurancePolicy.connect(driver).purchasePolicy(premium, coverage, duration, {
      value: premium,
    });

    const policy = await insurancePolicy.getPolicy(1);
    assert.equal(policy.driver, driver.address);
    assert.equal(policy.premium, premium);
    assert.equal(policy.coverage, coverage);
    assert.equal(policy.active, true);
    assert.equal(policy.expiryTime - policy.startTime, duration);

    await insurancePool.deposit({ value: ethers.parseEther("1") });

    await claimManager.connect(driver).submitClaim(1, coverage);
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

  it("accepts only 7, 30, and 90-day policy durations", async function () {
    const { ethers } = await hre.network.create();
    const [admin, driver] = await ethers.getSigners();

    const DriverRegistry = await ethers.getContractFactory("DriverRegistry");
    const driverRegistry = await DriverRegistry.deploy(admin.address);
    await driverRegistry.waitForDeployment();

    const SafetyScoreOracle = await ethers.getContractFactory("SafetyScoreOracle");
    const oracle = await SafetyScoreOracle.deploy(admin.address);
    await oracle.waitForDeployment();

    const InsurancePool = await ethers.getContractFactory("InsurancePool");
    const pool = await InsurancePool.deploy(admin.address);
    await pool.waitForDeployment();

    const InsurancePolicy = await ethers.getContractFactory("InsurancePolicy");
    const policy = await InsurancePolicy.deploy(
      admin.address,
      await driverRegistry.getAddress(),
      await oracle.getAddress(),
      await pool.getAddress()
    );
    await policy.waitForDeployment();

    await driverRegistry.grantRole(await driverRegistry.POLICY_MANAGER_ROLE(), await policy.getAddress());
    await driverRegistry.connect(driver).registerDriver(
      ethers.keccak256(ethers.toUtf8Bytes("duration-test-driver"))
    );

    const premium = ethers.parseEther("0.1");
    const coverage = ethers.parseEther("0.5");

    assert.equal(await policy.DURATION_7_DAYS(), 7n * 24n * 60n * 60n);
    assert.equal(await policy.DURATION_30_DAYS(), 30n * 24n * 60n * 60n);
    assert.equal(await policy.DURATION_90_DAYS(), 90n * 24n * 60n * 60n);

    await assert.rejects(
      policy.connect(driver).purchasePolicy(premium, coverage, 14n * 24n * 60n * 60n, { value: premium }),
      /InvalidDuration/
    );
  });
});
