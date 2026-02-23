const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CrossChainRouter", function () {
  async function fixture() {
    const [owner, sender, receiver] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const MockBridge = await ethers.getContractFactory("MockBridge");
    const bridge = await MockBridge.deploy();
    await bridge.waitForDeployment();

    const CrossChainRouter = await ethers.getContractFactory("CrossChainRouter");
    const ccRouter = await CrossChainRouter.deploy(
      await usdc.getAddress(),
      await bridge.getAddress(),
      ethers.ZeroAddress // localRouter not needed for send tests
    );
    await ccRouter.waitForDeployment();

    // Setup: set remote router for chain 2442 (zkEVM Cardona)
    const remoteRouterAddr = ethers.Wallet.createRandom().address;
    await ccRouter.setRemoteRouter(2442, remoteRouterAddr);

    // Mint USDC
    await usdc.mint(sender.address, ethers.parseUnits("10000", 6));

    return { usdc, bridge, ccRouter, owner, sender, receiver, remoteRouterAddr };
  }

  describe("sendCrossChainPayment", function () {
    it("should lock USDC and send bridge message", async function () {
      const { ccRouter, usdc, bridge, sender } = await loadFixture(fixture);
      const stealthAddr = ethers.Wallet.createRandom().address;
      const amount = ethers.parseUnits("100", 6);
      const ephPubKey = ethers.concat(["0x02", ethers.randomBytes(32)]);

      await usdc.connect(sender).approve(await ccRouter.getAddress(), amount);

      await expect(
        ccRouter.connect(sender).sendCrossChainPayment(2442, stealthAddr, amount, ephPubKey, 42)
      )
        .to.emit(ccRouter, "CrossChainPaymentSent")
        .withArgs(2442, stealthAddr, amount);

      // USDC should be locked in router
      expect(await usdc.balanceOf(await ccRouter.getAddress())).to.equal(amount);

      // Bridge should have 1 message
      expect(await bridge.messageCount()).to.equal(1);

      // Counter should increment
      expect(await ccRouter.totalSent()).to.equal(1);
    });

    it("should reject if no remote router set", async function () {
      const { ccRouter, usdc, sender } = await loadFixture(fixture);
      const amount = ethers.parseUnits("100", 6);
      await usdc.connect(sender).approve(await ccRouter.getAddress(), amount);

      await expect(
        ccRouter.connect(sender).sendCrossChainPayment(
          9999, // Unknown chain
          ethers.Wallet.createRandom().address,
          amount,
          ethers.concat(["0x02", ethers.randomBytes(32)]),
          0
        )
      ).to.be.revertedWith("CrossChainRouter: no remote router");
    });

    it("should reject zero amount", async function () {
      const { ccRouter, sender } = await loadFixture(fixture);
      await expect(
        ccRouter.connect(sender).sendCrossChainPayment(
          2442,
          ethers.Wallet.createRandom().address,
          0,
          ethers.concat(["0x02", ethers.randomBytes(32)]),
          0
        )
      ).to.be.revertedWith("CrossChainRouter: zero amount");
    });

    it("should reject zero stealth address", async function () {
      const { ccRouter, usdc, sender } = await loadFixture(fixture);
      const amount = ethers.parseUnits("100", 6);
      await usdc.connect(sender).approve(await ccRouter.getAddress(), amount);

      await expect(
        ccRouter.connect(sender).sendCrossChainPayment(
          2442,
          ethers.ZeroAddress,
          amount,
          ethers.concat(["0x02", ethers.randomBytes(32)]),
          0
        )
      ).to.be.revertedWith("CrossChainRouter: zero stealth");
    });
  });

  describe("receiveCrossChainPayment", function () {
    it("should only accept calls from bridge", async function () {
      const { ccRouter, sender } = await loadFixture(fixture);

      const message = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "bytes", "uint8", "uint256"],
        [sender.address, ethers.Wallet.createRandom().address, 100, "0x02", 0, 137]
      );

      await expect(
        ccRouter.connect(sender).receiveCrossChainPayment(message)
      ).to.be.revertedWith("CrossChainRouter: caller is not bridge");
    });
  });

  describe("receiveCrossChainPayment with announcer", function () {
    it("should reject receive when announcer not set", async function () {
      const { ccRouter, usdc, bridge, sender } = await loadFixture(fixture);

      // Deploy a fresh router WITHOUT announcer set
      const CrossChainRouter = await ethers.getContractFactory("CrossChainRouter");
      const freshRouter = await CrossChainRouter.deploy(
        await usdc.getAddress(),
        await bridge.getAddress(),
        ethers.ZeroAddress
      );
      await freshRouter.waitForDeployment();

      // Fund the router with USDC
      await usdc.mint(await freshRouter.getAddress(), ethers.parseUnits("1000", 6));

      const stealthAddr = ethers.Wallet.createRandom().address;
      const message = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "bytes", "uint8", "uint256"],
        [
          sender.address,
          stealthAddr,
          ethers.parseUnits("100", 6),
          ethers.concat(["0x02", ethers.randomBytes(32)]),
          42,
          137,
        ]
      );

      // Set bridge as the caller
      await freshRouter.setBridge(sender.address);

      await expect(
        freshRouter.connect(sender).receiveCrossChainPayment(message)
      ).to.be.revertedWith("CrossChainRouter: announcer not set");
    });
  });

  describe("Admin functions", function () {
    it("should update remote router", async function () {
      const { ccRouter } = await loadFixture(fixture);
      const newRouter = ethers.Wallet.createRandom().address;
      await ccRouter.setRemoteRouter(137, newRouter);
      expect(await ccRouter.remoteRouters(137)).to.equal(newRouter);
    });

    it("should update bridge", async function () {
      const { ccRouter } = await loadFixture(fixture);
      const newBridge = ethers.Wallet.createRandom().address;
      await ccRouter.setBridge(newBridge);
      expect(await ccRouter.bridge()).to.equal(newBridge);
    });

    it("should reject non-owner admin calls", async function () {
      const { ccRouter, sender } = await loadFixture(fixture);
      await expect(
        ccRouter.connect(sender).setRemoteRouter(137, ethers.ZeroAddress)
      ).to.be.reverted;
    });

    it("should allow emergency withdraw", async function () {
      const { ccRouter, usdc, owner } = await loadFixture(fixture);
      const amount = ethers.parseUnits("100", 6);
      await usdc.mint(await ccRouter.getAddress(), amount);

      await ccRouter.emergencyWithdraw(amount);
      expect(await usdc.balanceOf(owner.address)).to.be.gte(amount);
    });
  });
});
