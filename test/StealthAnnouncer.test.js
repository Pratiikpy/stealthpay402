const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("StealthAnnouncer", function () {
  async function fixture() {
    const [owner, caller] = await ethers.getSigners();
    const StealthAnnouncer = await ethers.getContractFactory("StealthAnnouncer");
    const announcer = await StealthAnnouncer.deploy();
    await announcer.waitForDeployment();
    return { announcer, owner, caller };
  }

  describe("announce", function () {
    it("should emit Announcement event with correct data", async function () {
      const { announcer, caller } = await loadFixture(fixture);
      const stealthAddr = ethers.Wallet.createRandom().address;
      const ephemeralPubKey = ethers.concat(["0x02", ethers.randomBytes(32)]);
      const metadata = ethers.toBeHex(42, 1); // viewTag = 42

      await expect(announcer.connect(caller).announce(1, stealthAddr, ephemeralPubKey, metadata))
        .to.emit(announcer, "Announcement")
        .withArgs(1n, stealthAddr, caller.address, ephemeralPubKey, metadata);
    });

    it("should increment announcement count", async function () {
      const { announcer } = await loadFixture(fixture);
      const stealthAddr1 = ethers.Wallet.createRandom().address;
      const stealthAddr2 = ethers.Wallet.createRandom().address;
      const ephemeralPubKey = ethers.concat(["0x02", ethers.randomBytes(32)]);
      const metadata = "0x01";

      expect(await announcer.announcementCount()).to.equal(0);
      await announcer.announce(1, stealthAddr1, ephemeralPubKey, metadata);
      expect(await announcer.announcementCount()).to.equal(1);
      await announcer.announce(1, stealthAddr2, ephemeralPubKey, metadata);
      expect(await announcer.announcementCount()).to.equal(2);
    });

    it("should reject duplicate stealth address announcement", async function () {
      const { announcer } = await loadFixture(fixture);
      const stealthAddr = ethers.Wallet.createRandom().address;
      const ephemeralPubKey = ethers.concat(["0x02", ethers.randomBytes(32)]);

      await announcer.announce(1, stealthAddr, ephemeralPubKey, "0x01");
      await expect(
        announcer.announce(1, stealthAddr, ephemeralPubKey, "0x01")
      ).to.be.revertedWith("StealthAnnouncer: already announced");
    });

    it("should reject unsupported scheme", async function () {
      const { announcer } = await loadFixture(fixture);
      const stealthAddr = ethers.Wallet.createRandom().address;
      const ephemeralPubKey = ethers.concat(["0x02", ethers.randomBytes(32)]);

      await expect(
        announcer.announce(2, stealthAddr, ephemeralPubKey, "0x01")
      ).to.be.revertedWith("StealthAnnouncer: unsupported scheme");
    });

    it("should reject zero stealth address", async function () {
      const { announcer } = await loadFixture(fixture);
      const ephemeralPubKey = ethers.concat(["0x02", ethers.randomBytes(32)]);

      await expect(
        announcer.announce(1, ethers.ZeroAddress, ephemeralPubKey, "0x01")
      ).to.be.revertedWith("StealthAnnouncer: zero stealth address");
    });

    it("should reject invalid ephemeral key length", async function () {
      const { announcer } = await loadFixture(fixture);
      const stealthAddr = ethers.Wallet.createRandom().address;

      // Empty key
      await expect(
        announcer.announce(1, stealthAddr, "0x", "0x01")
      ).to.be.revertedWith("StealthAnnouncer: invalid ephemeral key length");

      // Wrong length (10 bytes)
      await expect(
        announcer.announce(1, stealthAddr, ethers.randomBytes(10), "0x01")
      ).to.be.revertedWith("StealthAnnouncer: invalid ephemeral key length");
    });

    it("should return SCHEME_ID = 1", async function () {
      const { announcer } = await loadFixture(fixture);
      expect(await announcer.SCHEME_ID()).to.equal(1);
    });
  });
});
