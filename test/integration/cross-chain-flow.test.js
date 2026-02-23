const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Integration: Cross-Chain Flow", function () {
  async function fixture() {
    const [owner, sender, receiver] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const MockBridge = await ethers.getContractFactory("MockBridge");
    const bridge = await MockBridge.deploy();
    await bridge.waitForDeployment();

    const CrossChainRouter = await ethers.getContractFactory("CrossChainRouter");
    const sourceRouter = await CrossChainRouter.deploy(
      await usdc.getAddress(),
      await bridge.getAddress(),
      ethers.ZeroAddress
    );
    await sourceRouter.waitForDeployment();

    // Set remote router for destination chain
    const destRouterAddr = ethers.Wallet.createRandom().address;
    await sourceRouter.setRemoteRouter(2442, destRouterAddr);

    // Mint USDC
    await usdc.mint(sender.address, ethers.parseUnits("10000", 6));

    return { usdc, bridge, sourceRouter, owner, sender, receiver, destRouterAddr };
  }

  it("should send cross-chain payment and create bridge message", async function () {
    const { usdc, bridge, sourceRouter, sender } = await loadFixture(fixture);
    const stealthAddr = ethers.Wallet.createRandom().address;
    const amount = ethers.parseUnits("50", 6);
    const ephPubKey = ethers.concat(["0x02", ethers.randomBytes(32)]);
    const viewTag = 128;

    // Approve and send
    await usdc.connect(sender).approve(await sourceRouter.getAddress(), amount);
    await sourceRouter
      .connect(sender)
      .sendCrossChainPayment(2442, stealthAddr, amount, ephPubKey, viewTag);

    // Verify USDC locked
    expect(await usdc.balanceOf(await sourceRouter.getAddress())).to.equal(amount);

    // Verify bridge message created
    expect(await bridge.messageCount()).to.equal(1);
    const msg = await bridge.getMessage(0);
    expect(msg.destinationChainId).to.equal(2442);
  });

  it("should track cross-chain payment counters", async function () {
    const { usdc, sourceRouter, sender } = await loadFixture(fixture);
    const amount = ethers.parseUnits("10", 6);

    expect(await sourceRouter.totalSent()).to.equal(0);

    for (let i = 0; i < 3; i++) {
      await usdc.connect(sender).approve(await sourceRouter.getAddress(), amount);
      await sourceRouter.connect(sender).sendCrossChainPayment(
        2442,
        ethers.Wallet.createRandom().address,
        amount,
        ethers.concat(["0x02", ethers.randomBytes(32)]),
        0
      );
    }

    expect(await sourceRouter.totalSent()).to.equal(3);
  });
});
