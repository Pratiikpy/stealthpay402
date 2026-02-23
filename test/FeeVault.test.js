const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("FeeVault", function () {
  async function fixture() {
    const [owner, treasury, depositor, newTreasury] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const FeeVault = await ethers.getContractFactory("FeeVault");
    const vault = await FeeVault.deploy(await usdc.getAddress(), treasury.address);
    await vault.waitForDeployment();

    // Mint USDC for testing
    await usdc.mint(depositor.address, ethers.parseUnits("10000", 6));
    await usdc.mint(owner.address, ethers.parseUnits("10000", 6));

    return { usdc, vault, owner, treasury, depositor, newTreasury };
  }

  describe("Deployment", function () {
    it("should set correct name and symbol", async function () {
      const { vault } = await loadFixture(fixture);
      expect(await vault.name()).to.equal("StealthPay402 Fee Vault");
      expect(await vault.symbol()).to.equal("spFEE");
    });

    it("should set treasury address", async function () {
      const { vault, treasury } = await loadFixture(fixture);
      expect(await vault.treasury()).to.equal(treasury.address);
    });

    it("should use 6 decimals (matching USDC)", async function () {
      const { vault } = await loadFixture(fixture);
      expect(await vault.decimals()).to.equal(6);
    });
  });

  describe("ERC4626 Operations", function () {
    it("should accept deposits", async function () {
      const { vault, usdc, depositor } = await loadFixture(fixture);
      const amount = ethers.parseUnits("100", 6);

      await usdc.connect(depositor).approve(await vault.getAddress(), amount);
      await vault.connect(depositor).deposit(amount, depositor.address);

      expect(await vault.totalAssets()).to.equal(amount);
      expect(await vault.balanceOf(depositor.address)).to.be.gt(0);
    });

    it("should allow withdrawals", async function () {
      const { vault, usdc, depositor } = await loadFixture(fixture);
      const amount = ethers.parseUnits("100", 6);

      await usdc.connect(depositor).approve(await vault.getAddress(), amount);
      await vault.connect(depositor).deposit(amount, depositor.address);

      const shares = await vault.balanceOf(depositor.address);
      await vault.connect(depositor).redeem(shares, depositor.address, depositor.address);

      expect(await vault.totalAssets()).to.equal(0);
    });
  });

  describe("Treasury", function () {
    it("should withdraw to treasury", async function () {
      const { vault, usdc, owner, treasury } = await loadFixture(fixture);
      const amount = ethers.parseUnits("500", 6);

      // Simulate fee collection by directly transferring USDC to vault
      await usdc.transfer(await vault.getAddress(), amount);

      const treasuryBefore = await usdc.balanceOf(treasury.address);
      await expect(vault.withdrawToTreasury(amount))
        .to.emit(vault, "TreasuryWithdrawal")
        .withArgs(treasury.address, amount);

      expect(await usdc.balanceOf(treasury.address)).to.equal(treasuryBefore + amount);
    });

    it("should reject zero withdrawal", async function () {
      const { vault } = await loadFixture(fixture);
      await expect(vault.withdrawToTreasury(0)).to.be.revertedWith("FeeVault: zero amount");
    });

    it("should reject withdrawal exceeding balance", async function () {
      const { vault } = await loadFixture(fixture);
      await expect(
        vault.withdrawToTreasury(ethers.parseUnits("1000", 6))
      ).to.be.revertedWith("FeeVault: insufficient assets");
    });

    it("should update treasury address", async function () {
      const { vault, treasury, newTreasury } = await loadFixture(fixture);

      await expect(vault.setTreasury(newTreasury.address))
        .to.emit(vault, "TreasuryUpdated")
        .withArgs(treasury.address, newTreasury.address);

      expect(await vault.treasury()).to.equal(newTreasury.address);
    });

    it("should reject zero treasury address", async function () {
      const { vault } = await loadFixture(fixture);
      await expect(vault.setTreasury(ethers.ZeroAddress)).to.be.revertedWith(
        "FeeVault: zero treasury"
      );
    });

    it("should reject non-owner treasury operations", async function () {
      const { vault, depositor, newTreasury } = await loadFixture(fixture);
      await expect(
        vault.connect(depositor).withdrawToTreasury(100)
      ).to.be.reverted;
      await expect(
        vault.connect(depositor).setTreasury(newTreasury.address)
      ).to.be.reverted;
    });
  });
});
