const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { deployFullSystem, createPaymentParams, generateTestStealthAddress } = require("../helpers/setup");

describe("Integration: Compliance Flow", function () {
  async function fixture() {
    const system = await deployFullSystem();

    // Set up MockPolygonID as verifier
    await system.complianceGate.setVerifier(await system.mockPolygonID.getAddress());

    return system;
  }

  it("should verify agent via Polygon ID and allow payment", async function () {
    const { usdc, router, complianceGate, mockPolygonID, agent1 } = await loadFixture(fixture);

    // Enable compliance
    await complianceGate.setComplianceRequired(true);

    // Prepare a valid ZK proof
    const proof = ethers.toUtf8Bytes("valid-kyc-proof-data");
    const proofHash = ethers.keccak256(proof);
    await mockPolygonID.setProofResult(proofHash, true);

    // Verify compliance
    await complianceGate.verifyCompliance(agent1.address, proof);
    expect(await complianceGate.isCompliant(agent1.address)).to.be.true;

    // Now payment should succeed
    const params = await createPaymentParams(
      usdc,
      agent1,
      await router.getAddress(),
      ethers.parseUnits("10", 6),
      generateTestStealthAddress()
    );

    await expect(router.processPayment(params)).to.emit(router, "PaymentProcessed");
  });

  it("should block payment when agent fails compliance check", async function () {
    const { usdc, router, complianceGate, mockPolygonID, agent1 } = await loadFixture(fixture);

    await complianceGate.setComplianceRequired(true);

    // Agent has NOT verified compliance
    const params = await createPaymentParams(
      usdc,
      agent1,
      await router.getAddress(),
      ethers.parseUnits("10", 6),
      generateTestStealthAddress()
    );

    await expect(router.processPayment(params)).to.be.revertedWith(
      "Router: compliance check failed"
    );
  });

  it("should allow toggling compliance on and off", async function () {
    const { usdc, router, complianceGate, agent1 } = await loadFixture(fixture);

    // Payment works without compliance
    const params1 = await createPaymentParams(
      usdc,
      agent1,
      await router.getAddress(),
      ethers.parseUnits("5", 6),
      generateTestStealthAddress()
    );
    await expect(router.processPayment(params1)).to.emit(router, "PaymentProcessed");

    // Enable compliance — payment fails
    await complianceGate.setComplianceRequired(true);

    const params2 = await createPaymentParams(
      usdc,
      agent1,
      await router.getAddress(),
      ethers.parseUnits("5", 6),
      generateTestStealthAddress()
    );
    await expect(router.processPayment(params2)).to.be.revertedWith(
      "Router: compliance check failed"
    );

    // Disable compliance — payment works again
    await complianceGate.setComplianceRequired(false);

    const params3 = await createPaymentParams(
      usdc,
      agent1,
      await router.getAddress(),
      ethers.parseUnits("5", 6),
      generateTestStealthAddress()
    );
    await expect(router.processPayment(params3)).to.emit(router, "PaymentProcessed");
  });
});
