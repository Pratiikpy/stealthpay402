const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("AgentRegistry", function () {
  async function fixture() {
    const [owner, router, agent1, agent2, attacker] = await ethers.getSigners();

    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    const registry = await AgentRegistry.deploy();
    await registry.waitForDeployment();

    // Set the router
    await registry.setRouter(router.address);

    return { registry, owner, router, agent1, agent2, attacker };
  }

  describe("Registration", function () {
    it("should register an agent", async function () {
      const { registry, agent1 } = await loadFixture(fixture);
      const metadataHash = ethers.id("agent1-metadata");

      await expect(registry.connect(agent1).registerAgent(metadataHash))
        .to.emit(registry, "AgentRegistered")
        .withArgs(agent1.address, metadataHash);

      const agent = await registry.getAgent(agent1.address);
      expect(agent.isActive).to.be.true;
      expect(agent.owner).to.equal(agent1.address);
      expect(agent.reputationScore).to.equal(500); // Neutral start
      expect(agent.dailySpendLimit).to.equal(ethers.parseUnits("1000", 6));
    });

    it("should reject double registration", async function () {
      const { registry, agent1 } = await loadFixture(fixture);
      const metadataHash = ethers.id("agent1");

      await registry.connect(agent1).registerAgent(metadataHash);
      await expect(
        registry.connect(agent1).registerAgent(metadataHash)
      ).to.be.revertedWith("AgentRegistry: already registered");
    });

    it("should increment totalAgents", async function () {
      const { registry, agent1, agent2 } = await loadFixture(fixture);
      expect(await registry.totalAgents()).to.equal(0);

      await registry.connect(agent1).registerAgent(ethers.id("a1"));
      expect(await registry.totalAgents()).to.equal(1);

      await registry.connect(agent2).registerAgent(ethers.id("a2"));
      expect(await registry.totalAgents()).to.equal(2);
    });

    it("should require registration fee if set", async function () {
      const { registry, agent1, owner } = await loadFixture(fixture);
      const fee = ethers.parseEther("0.01");
      await registry.setRegistrationFee(fee);

      await expect(
        registry.connect(agent1).registerAgent(ethers.id("a1"))
      ).to.be.revertedWith("AgentRegistry: insufficient fee");

      await expect(
        registry.connect(agent1).registerAgent(ethers.id("a1"), { value: fee })
      ).to.emit(registry, "AgentRegistered");
    });
  });

  describe("recordTransaction", function () {
    it("should record transaction and update stats", async function () {
      const { registry, router, agent1 } = await loadFixture(fixture);
      await registry.connect(agent1).registerAgent(ethers.id("a1"));

      const amount = ethers.parseUnits("50", 6);
      await expect(registry.connect(router).recordTransaction(agent1.address, amount))
        .to.emit(registry, "TransactionRecorded")
        .withArgs(agent1.address, amount, 1n);

      const agent = await registry.getAgent(agent1.address);
      expect(agent.totalTransactions).to.equal(1);
      expect(agent.totalVolume).to.equal(amount);
      expect(agent.spentToday).to.equal(amount);
    });

    it("should enforce daily spend limit", async function () {
      const { registry, router, agent1 } = await loadFixture(fixture);
      await registry.connect(agent1).registerAgent(ethers.id("a1"));

      // Default limit is 1000 USDC
      const amount = ethers.parseUnits("500", 6);
      await registry.connect(router).recordTransaction(agent1.address, amount);
      await registry.connect(router).recordTransaction(agent1.address, amount);

      // This should fail — would exceed 1000 USDC daily limit
      await expect(
        registry.connect(router).recordTransaction(agent1.address, ethers.parseUnits("1", 6))
      ).to.be.revertedWith("AgentRegistry: daily limit exceeded");
    });

    it("should reset daily limit after 24 hours", async function () {
      const { registry, router, agent1 } = await loadFixture(fixture);
      await registry.connect(agent1).registerAgent(ethers.id("a1"));

      const amount = ethers.parseUnits("900", 6);
      await registry.connect(router).recordTransaction(agent1.address, amount);

      // Fast forward 24+ hours
      await time.increase(86401);

      // Should work again after reset
      await expect(
        registry.connect(router).recordTransaction(agent1.address, amount)
      ).to.emit(registry, "TransactionRecorded");
    });

    it("should only allow router to record transactions", async function () {
      const { registry, agent1, attacker } = await loadFixture(fixture);
      await registry.connect(agent1).registerAgent(ethers.id("a1"));

      await expect(
        registry.connect(attacker).recordTransaction(agent1.address, 100)
      ).to.be.revertedWith("AgentRegistry: caller is not router");
    });

    it("should auto-update reputation every 10 transactions", async function () {
      const { registry, router, agent1 } = await loadFixture(fixture);
      await registry.connect(agent1).registerAgent(ethers.id("a1"));

      const amount = ethers.parseUnits("10", 6);
      for (let i = 0; i < 10; i++) {
        await registry.connect(router).recordTransaction(agent1.address, amount);
      }

      const agent = await registry.getAgent(agent1.address);
      expect(agent.reputationScore).to.equal(510); // 500 + 10
    });
  });

  describe("Admin functions", function () {
    it("should allow owner to update reputation", async function () {
      const { registry, agent1 } = await loadFixture(fixture);
      await registry.connect(agent1).registerAgent(ethers.id("a1"));

      await expect(registry.updateReputation(agent1.address, 900))
        .to.emit(registry, "ReputationUpdated")
        .withArgs(agent1.address, 500, 900);
    });

    it("should reject reputation score above 1000", async function () {
      const { registry, agent1 } = await loadFixture(fixture);
      await registry.connect(agent1).registerAgent(ethers.id("a1"));

      await expect(registry.updateReputation(agent1.address, 1001))
        .to.be.revertedWith("AgentRegistry: score exceeds max");
    });

    it("should cap auto-reputation at 1000", async function () {
      const { registry, router, agent1 } = await loadFixture(fixture);
      await registry.connect(agent1).registerAgent(ethers.id("a1"));

      // Set reputation to 995 manually
      await registry.updateReputation(agent1.address, 995);

      // Do 10 transactions to trigger auto-update (+10)
      const amount = ethers.parseUnits("1", 6);
      for (let i = 0; i < 10; i++) {
        await registry.connect(router).recordTransaction(agent1.address, amount);
      }

      const agent = await registry.getAgent(agent1.address);
      expect(agent.reputationScore).to.equal(1000); // Capped at 1000, not 1005
    });

    it("should allow agent to set own daily limit", async function () {
      const { registry, agent1 } = await loadFixture(fixture);
      await registry.connect(agent1).registerAgent(ethers.id("a1"));

      const newLimit = ethers.parseUnits("5000", 6);
      await expect(registry.connect(agent1).setDailyLimit(newLimit))
        .to.emit(registry, "DailyLimitUpdated");
    });

    it("should allow owner to deactivate agent", async function () {
      const { registry, agent1 } = await loadFixture(fixture);
      await registry.connect(agent1).registerAgent(ethers.id("a1"));

      await expect(registry.deactivateAgent(agent1.address))
        .to.emit(registry, "AgentDeactivated")
        .withArgs(agent1.address);

      expect(await registry.isRegistered(agent1.address)).to.be.false;
    });
  });
});
