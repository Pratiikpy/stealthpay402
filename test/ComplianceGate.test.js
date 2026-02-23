const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ComplianceGate", function () {
  async function fixture() {
    const [owner, agent1, agent2] = await ethers.getSigners();

    const ComplianceGate = await ethers.getContractFactory("ComplianceGate");
    const gate = await ComplianceGate.deploy();
    await gate.waitForDeployment();

    const MockPolygonID = await ethers.getContractFactory("MockPolygonID");
    const mockVerifier = await MockPolygonID.deploy();
    await mockVerifier.waitForDeployment();

    return { gate, mockVerifier, owner, agent1, agent2 };
  }

  describe("Deployment", function () {
    it("should start with compliance disabled", async function () {
      const { gate } = await loadFixture(fixture);
      expect(await gate.complianceRequired()).to.be.false;
    });
  });

  describe("checkCompliance", function () {
    it("should return true when compliance not required", async function () {
      const { gate, agent1 } = await loadFixture(fixture);
      expect(await gate.checkCompliance(agent1.address)).to.be.true;
    });

    it("should return false for unverified agent when compliance required", async function () {
      const { gate, agent1 } = await loadFixture(fixture);
      await gate.setComplianceRequired(true);
      expect(await gate.checkCompliance(agent1.address)).to.be.false;
    });

    it("should return true for verified agent when compliance required", async function () {
      const { gate, agent1 } = await loadFixture(fixture);
      await gate.setComplianceRequired(true);
      await gate.setCompliance(agent1.address, true);
      expect(await gate.checkCompliance(agent1.address)).to.be.true;
    });
  });

  describe("verifyCompliance", function () {
    it("should auto-verify when no verifier set", async function () {
      const { gate, agent1 } = await loadFixture(fixture);
      const proof = ethers.toUtf8Bytes("mock-zk-proof");

      await expect(gate.verifyCompliance(agent1.address, proof))
        .to.emit(gate, "ComplianceVerified")
        .withArgs(agent1.address, await ethers.provider.getBlock("latest").then((b) => b.timestamp + 1));
    });

    it("should verify with mock Polygon ID verifier", async function () {
      const { gate, mockVerifier, agent1 } = await loadFixture(fixture);
      const proof = ethers.toUtf8Bytes("valid-proof");
      const proofHash = ethers.keccak256(proof);

      await gate.setVerifier(await mockVerifier.getAddress());
      await mockVerifier.setProofResult(proofHash, true);

      await expect(gate.verifyCompliance(agent1.address, proof))
        .to.emit(gate, "ComplianceVerified");

      expect(await gate.isCompliant(agent1.address)).to.be.true;
    });

    it("should reject invalid proof", async function () {
      const { gate, mockVerifier, agent1 } = await loadFixture(fixture);
      const proof = ethers.toUtf8Bytes("invalid-proof");
      const proofHash = ethers.keccak256(proof);

      await gate.setVerifier(await mockVerifier.getAddress());
      await mockVerifier.setProofResult(proofHash, false);

      await expect(
        gate.verifyCompliance(agent1.address, proof)
      ).to.be.revertedWith("ComplianceGate: proof invalid");
    });

    it("should reject zero agent address", async function () {
      const { gate } = await loadFixture(fixture);
      await expect(
        gate.verifyCompliance(ethers.ZeroAddress, "0x01")
      ).to.be.revertedWith("ComplianceGate: zero agent");
    });

    it("should reject empty proof", async function () {
      const { gate, agent1 } = await loadFixture(fixture);
      await expect(
        gate.verifyCompliance(agent1.address, "0x")
      ).to.be.revertedWith("ComplianceGate: empty proof");
    });
  });

  describe("Compliance Expiry", function () {
    it("should reject expired compliance", async function () {
      const { gate, agent1 } = await loadFixture(fixture);

      // Verify agent and enable compliance
      await gate.setCompliance(agent1.address, true);
      await gate.setComplianceRequired(true);
      expect(await gate.checkCompliance(agent1.address)).to.be.true;

      // Fast-forward past expiry (365 days + 1 second)
      await ethers.provider.send("evm_increaseTime", [365 * 24 * 3600 + 1]);
      await ethers.provider.send("evm_mine");

      expect(await gate.checkCompliance(agent1.address)).to.be.false;
    });

    it("should allow setting compliance expiry", async function () {
      const { gate } = await loadFixture(fixture);
      await gate.setComplianceExpiry(30 * 24 * 3600); // 30 days
      expect(await gate.complianceExpiry()).to.equal(30 * 24 * 3600);
    });

    it("should reject expiry shorter than 1 day", async function () {
      const { gate } = await loadFixture(fixture);
      await expect(
        gate.setComplianceExpiry(3600) // 1 hour
      ).to.be.revertedWith("ComplianceGate: expiry too short");
    });

    it("should pass compliance check within expiry window", async function () {
      const { gate, agent1 } = await loadFixture(fixture);

      await gate.setCompliance(agent1.address, true);
      await gate.setComplianceRequired(true);

      // Fast-forward 364 days (within 365-day expiry)
      await ethers.provider.send("evm_increaseTime", [364 * 24 * 3600]);
      await ethers.provider.send("evm_mine");

      expect(await gate.checkCompliance(agent1.address)).to.be.true;
    });
  });

  describe("Admin functions", function () {
    it("should toggle compliance requirement", async function () {
      const { gate } = await loadFixture(fixture);

      await expect(gate.setComplianceRequired(true))
        .to.emit(gate, "ComplianceRequirementChanged")
        .withArgs(true);

      expect(await gate.complianceRequired()).to.be.true;
    });

    it("should allow manual compliance setting", async function () {
      const { gate, agent1 } = await loadFixture(fixture);

      await gate.setCompliance(agent1.address, true);
      expect(await gate.isCompliant(agent1.address)).to.be.true;

      await gate.setCompliance(agent1.address, false);
      expect(await gate.isCompliant(agent1.address)).to.be.false;
    });

    it("should reject non-owner admin calls", async function () {
      const { gate, agent1 } = await loadFixture(fixture);
      await expect(gate.connect(agent1).setComplianceRequired(true)).to.be.reverted;
      await expect(gate.connect(agent1).setCompliance(agent1.address, true)).to.be.reverted;
    });
  });
});
