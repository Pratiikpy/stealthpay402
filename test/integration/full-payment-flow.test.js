const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const {
  deployFullSystem,
  createPaymentParams,
  generateTestStealthAddress,
} = require("../helpers/setup");

describe("Integration: Full Payment Flow", function () {
  async function fixture() {
    return deployFullSystem();
  }

  it("should complete full x402 + stealth payment flow end-to-end", async function () {
    const { usdc, announcer, metaRegistry, feeVault, router, agentRegistry, agent1, treasury } =
      await loadFixture(fixture);

    // ── Step 1: Agent registers in the AgentRegistry ──
    const metadataHash = ethers.id("AI Weather Agent v1.0");
    await agentRegistry.connect(agent1).registerAgent(metadataHash);

    const agentInfo = await agentRegistry.getAgent(agent1.address);
    expect(agentInfo.isActive).to.be.true;
    expect(agentInfo.reputationScore).to.equal(500);

    // ── Step 2: Receiver registers stealth meta-address ──
    // In production, the receiver generates a spending keypair and viewing keypair
    // The meta-address = spendingPubKey || viewingPubKey (66 bytes for compressed)
    const spendingPubKey = ethers.concat(["0x02", ethers.randomBytes(32)]); // 33 bytes
    const viewingPubKey = ethers.concat(["0x03", ethers.randomBytes(32)]); // 33 bytes
    const metaAddress = ethers.concat([spendingPubKey, viewingPubKey]); // 66 bytes

    // For testing, receiver is treasury address
    await metaRegistry.connect(treasury).registerKeys(1, metaAddress);

    const storedMeta = await metaRegistry.stealthMetaAddressOf(treasury.address, 1);
    expect(storedMeta).to.equal(ethers.hexlify(metaAddress));

    // ── Step 3: Agent makes a payment (x402 flow) ──
    // In production:
    //   1. Agent calls API → gets 402 with payment instructions
    //   2. Agent generates stealth address from receiver's meta-address
    //   3. Agent signs EIP-3009 authorization
    //   4. Agent retries API call with X-PAYMENT header
    //   5. Facilitator submits payment to router

    const stealthAddress = generateTestStealthAddress();
    const amount = ethers.parseUnits("10", 6); // 10 USDC

    const params = await createPaymentParams(
      usdc,
      agent1,
      await router.getAddress(),
      amount,
      stealthAddress
    );

    const agent1BalanceBefore = await usdc.balanceOf(agent1.address);

    // Process the payment
    const tx = await router.processPayment(params);
    const receipt = await tx.wait();

    // ── Step 4: Verify payment routing ──
    const fee = amount / 1000n; // 0.1% of 10 USDC = 0.01 USDC
    const recipientAmount = amount - fee;

    // Agent's balance decreased by total amount
    expect(await usdc.balanceOf(agent1.address)).to.equal(agent1BalanceBefore - amount);

    // Stealth address received payment minus fee
    expect(await usdc.balanceOf(stealthAddress)).to.equal(recipientAmount);

    // Fee vault received the fee
    expect(await usdc.balanceOf(await feeVault.getAddress())).to.equal(fee);

    // ── Step 5: Verify announcement event ──
    // Check that StealthAnnouncer emitted an Announcement event
    const announcerFilter = announcer.filters.Announcement(1n, stealthAddress);
    const events = await announcer.queryFilter(announcerFilter);
    expect(events.length).to.equal(1);
    expect(events[0].args.ephemeralPubKey).to.equal(params.ephemeralPubKey);

    // ── Step 6: Verify agent stats were updated ──
    const updatedAgent = await agentRegistry.getAgent(agent1.address);
    expect(updatedAgent.totalTransactions).to.equal(1);
    expect(updatedAgent.totalVolume).to.equal(amount);
    expect(updatedAgent.spentToday).to.equal(amount);

    // ── Step 7: Verify announcement count ──
    expect(await announcer.announcementCount()).to.equal(1);
  });

  it("should handle multiple sequential payments from same agent", async function () {
    const { usdc, router, agentRegistry, agent1, feeVault } = await loadFixture(fixture);

    await agentRegistry.connect(agent1).registerAgent(ethers.id("multi-pay-agent"));

    const amount = ethers.parseUnits("5", 6);
    const payments = 5;

    for (let i = 0; i < payments; i++) {
      const params = await createPaymentParams(
        usdc,
        agent1,
        await router.getAddress(),
        amount,
        generateTestStealthAddress()
      );
      await router.processPayment(params);
    }

    // Check agent stats
    const agent = await agentRegistry.getAgent(agent1.address);
    expect(agent.totalTransactions).to.equal(payments);
    expect(agent.totalVolume).to.equal(amount * BigInt(payments));

    // Check total fees
    const expectedTotalFees = (amount * BigInt(payments)) / 1000n;
    expect(await usdc.balanceOf(await feeVault.getAddress())).to.equal(expectedTotalFees);
  });

  it("should handle batch payment flow", async function () {
    const { usdc, router, agent1 } = await loadFixture(fixture);
    const amount = ethers.parseUnits("2", 6);

    const batchParams = [];
    for (let i = 0; i < 3; i++) {
      const params = await createPaymentParams(
        usdc,
        agent1,
        await router.getAddress(),
        amount,
        generateTestStealthAddress()
      );
      batchParams.push(params);
    }

    await expect(router.batchProcessPayments(batchParams))
      .to.emit(router, "BatchProcessed")
      .withArgs(3n, amount * 3n, (amount * 3n) / 1000n);
  });

  it("should enforce compliance gate when enabled", async function () {
    const { usdc, router, complianceGate, agent1 } = await loadFixture(fixture);

    // Enable compliance requirement
    await complianceGate.setComplianceRequired(true);

    const params = await createPaymentParams(
      usdc,
      agent1,
      await router.getAddress(),
      ethers.parseUnits("10", 6),
      generateTestStealthAddress()
    );

    // Should fail - agent is not compliant
    await expect(router.processPayment(params)).to.be.revertedWith(
      "Router: compliance check failed"
    );

    // Set agent as compliant
    await complianceGate.setCompliance(agent1.address, true);

    // Create new params (old nonce is already marked processed)
    const params2 = await createPaymentParams(
      usdc,
      agent1,
      await router.getAddress(),
      ethers.parseUnits("10", 6),
      generateTestStealthAddress()
    );

    // Should work now
    await expect(router.processPayment(params2)).to.emit(router, "PaymentProcessed");
  });

  it("should support fee vault treasury withdrawal", async function () {
    const { usdc, router, feeVault, agent1, treasury } = await loadFixture(fixture);

    // Make several payments to accumulate fees
    for (let i = 0; i < 5; i++) {
      const params = await createPaymentParams(
        usdc,
        agent1,
        await router.getAddress(),
        ethers.parseUnits("100", 6),
        generateTestStealthAddress()
      );
      await router.processPayment(params);
    }

    // Check accumulated fees
    const totalFees = await usdc.balanceOf(await feeVault.getAddress());
    expect(totalFees).to.be.gt(0);

    // Withdraw to treasury
    const treasuryBefore = await usdc.balanceOf(treasury.address);
    await feeVault.withdrawToTreasury(totalFees);

    expect(await usdc.balanceOf(treasury.address)).to.equal(treasuryBefore + totalFees);
  });
});
