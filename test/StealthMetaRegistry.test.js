const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("StealthMetaRegistry", function () {
  async function fixture() {
    const [owner, registrant, thirdParty] = await ethers.getSigners();
    const StealthMetaRegistry = await ethers.getContractFactory("StealthMetaRegistry");
    const registry = await StealthMetaRegistry.deploy();
    await registry.waitForDeployment();
    return { registry, owner, registrant, thirdParty };
  }

  // Generate a valid 66-byte meta-address (spending + viewing compressed pubkeys)
  function generateMetaAddress() {
    const spendingKey = ethers.concat(["0x02", ethers.randomBytes(32)]); // 33 bytes
    const viewingKey = ethers.concat(["0x03", ethers.randomBytes(32)]); // 33 bytes
    return ethers.concat([spendingKey, viewingKey]); // 66 bytes
  }

  describe("registerKeys", function () {
    it("should store stealth meta-address for caller", async function () {
      const { registry, registrant } = await loadFixture(fixture);
      const metaAddress = generateMetaAddress();

      await registry.connect(registrant).registerKeys(1, metaAddress);

      const stored = await registry.stealthMetaAddressOf(registrant.address, 1);
      expect(stored).to.equal(ethers.hexlify(metaAddress));
    });

    it("should emit StealthMetaAddressSet event", async function () {
      const { registry, registrant } = await loadFixture(fixture);
      const metaAddress = generateMetaAddress();

      await expect(registry.connect(registrant).registerKeys(1, metaAddress))
        .to.emit(registry, "StealthMetaAddressSet")
        .withArgs(registrant.address, 1n, ethers.hexlify(metaAddress));
    });

    it("should allow updating meta-address", async function () {
      const { registry, registrant } = await loadFixture(fixture);
      const metaAddress1 = generateMetaAddress();
      const metaAddress2 = generateMetaAddress();

      await registry.connect(registrant).registerKeys(1, metaAddress1);
      await registry.connect(registrant).registerKeys(1, metaAddress2);

      const stored = await registry.stealthMetaAddressOf(registrant.address, 1);
      expect(stored).to.equal(ethers.hexlify(metaAddress2));
    });

    it("should reject empty meta-address", async function () {
      const { registry, registrant } = await loadFixture(fixture);
      await expect(
        registry.connect(registrant).registerKeys(1, "0x")
      ).to.be.revertedWith("StealthMetaRegistry: empty meta-address");
    });

    it("should reject invalid scheme ID", async function () {
      const { registry, registrant } = await loadFixture(fixture);
      const metaAddress = generateMetaAddress();
      await expect(
        registry.connect(registrant).registerKeys(0, metaAddress)
      ).to.be.revertedWith("StealthMetaRegistry: invalid scheme");
    });
  });

  describe("registerKeysOnBehalf", function () {
    it("should register with valid EIP-712 signature", async function () {
      const { registry, registrant, thirdParty } = await loadFixture(fixture);
      const metaAddress = generateMetaAddress();

      const domain = {
        name: "StealthMetaRegistry",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await registry.getAddress(),
      };

      const types = {
        RegisterKeys: [
          { name: "registrant", type: "address" },
          { name: "schemeId", type: "uint256" },
          { name: "stealthMetaAddress", type: "bytes" },
          { name: "nonce", type: "uint256" },
        ],
      };

      const message = {
        registrant: registrant.address,
        schemeId: 1n,
        stealthMetaAddress: ethers.hexlify(metaAddress),
        nonce: 0n,
      };

      const signature = await registrant.signTypedData(domain, types, message);

      await expect(
        registry.connect(thirdParty).registerKeysOnBehalf(registrant.address, 1, metaAddress, signature)
      )
        .to.emit(registry, "StealthMetaAddressSet")
        .withArgs(registrant.address, 1n, ethers.hexlify(metaAddress));
    });

    it("should reject invalid signature", async function () {
      const { registry, registrant, thirdParty } = await loadFixture(fixture);
      const metaAddress = generateMetaAddress();
      const fakeSig = ethers.randomBytes(65);

      await expect(
        registry.connect(thirdParty).registerKeysOnBehalf(registrant.address, 1, metaAddress, fakeSig)
      ).to.be.reverted;
    });

    it("should increment nonce after use", async function () {
      const { registry, registrant, thirdParty } = await loadFixture(fixture);

      expect(await registry.nonces(registrant.address)).to.equal(0);

      const metaAddress = generateMetaAddress();
      const domain = {
        name: "StealthMetaRegistry",
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await registry.getAddress(),
      };
      const types = {
        RegisterKeys: [
          { name: "registrant", type: "address" },
          { name: "schemeId", type: "uint256" },
          { name: "stealthMetaAddress", type: "bytes" },
          { name: "nonce", type: "uint256" },
        ],
      };
      const message = {
        registrant: registrant.address,
        schemeId: 1n,
        stealthMetaAddress: ethers.hexlify(metaAddress),
        nonce: 0n,
      };
      const signature = await registrant.signTypedData(domain, types, message);

      await registry.connect(thirdParty).registerKeysOnBehalf(registrant.address, 1, metaAddress, signature);

      expect(await registry.nonces(registrant.address)).to.equal(1);
    });
  });

  describe("stealthMetaAddressOf", function () {
    it("should return empty bytes for unregistered address", async function () {
      const { registry, registrant } = await loadFixture(fixture);
      const result = await registry.stealthMetaAddressOf(registrant.address, 1);
      expect(result).to.equal("0x");
    });
  });
});
