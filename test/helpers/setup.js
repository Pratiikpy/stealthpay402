const { ethers } = require("hardhat");

/**
 * Shared test fixtures and deploy helpers for StealthPay402 tests.
 * Deploys all contracts in the correct order with proper linking.
 */

async function deployFullSystem() {
  const [owner, agent1, agent2, facilitator, treasury, receiver, attacker] =
    await ethers.getSigners();

  // 1. Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  // 2. Deploy StealthAnnouncer
  const StealthAnnouncer = await ethers.getContractFactory("StealthAnnouncer");
  const announcer = await StealthAnnouncer.deploy();
  await announcer.waitForDeployment();

  // 3. Deploy StealthMetaRegistry
  const StealthMetaRegistry = await ethers.getContractFactory("StealthMetaRegistry");
  const metaRegistry = await StealthMetaRegistry.deploy();
  await metaRegistry.waitForDeployment();

  // 4. Deploy FeeVault
  const FeeVault = await ethers.getContractFactory("FeeVault");
  const feeVault = await FeeVault.deploy(await usdc.getAddress(), treasury.address);
  await feeVault.waitForDeployment();

  // 5. Deploy StealthPaymentRouter
  const StealthPaymentRouter = await ethers.getContractFactory("StealthPaymentRouter");
  const router = await StealthPaymentRouter.deploy(
    await usdc.getAddress(),
    await announcer.getAddress(),
    await feeVault.getAddress()
  );
  await router.waitForDeployment();

  // 6. Deploy AgentRegistry
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();

  // 7. Deploy ComplianceGate
  const ComplianceGate = await ethers.getContractFactory("ComplianceGate");
  const complianceGate = await ComplianceGate.deploy();
  await complianceGate.waitForDeployment();

  // 8. Deploy MockPolygonID
  const MockPolygonID = await ethers.getContractFactory("MockPolygonID");
  const mockPolygonID = await MockPolygonID.deploy();
  await mockPolygonID.waitForDeployment();

  // 9. Deploy MockBridge
  const MockBridge = await ethers.getContractFactory("MockBridge");
  const mockBridge = await MockBridge.deploy();
  await mockBridge.waitForDeployment();

  // 10. Deploy CrossChainRouter
  const CrossChainRouter = await ethers.getContractFactory("CrossChainRouter");
  const crossChainRouter = await CrossChainRouter.deploy(
    await usdc.getAddress(),
    await mockBridge.getAddress(),
    await router.getAddress()
  );
  await crossChainRouter.waitForDeployment();

  // ── Link contracts ──
  await router.setAgentRegistry(await agentRegistry.getAddress());
  await router.setComplianceGate(await complianceGate.getAddress());
  await agentRegistry.setRouter(await router.getAddress());

  // ── Mint test USDC ──
  const MINT_AMOUNT = ethers.parseUnits("100000", 6); // 100k USDC
  await usdc.mint(agent1.address, MINT_AMOUNT);
  await usdc.mint(agent2.address, MINT_AMOUNT);
  await usdc.mint(owner.address, MINT_AMOUNT);

  return {
    usdc,
    announcer,
    metaRegistry,
    feeVault,
    router,
    agentRegistry,
    complianceGate,
    mockPolygonID,
    mockBridge,
    crossChainRouter,
    owner,
    agent1,
    agent2,
    facilitator,
    treasury,
    receiver,
    attacker,
  };
}

/**
 * Sign an EIP-3009 transferWithAuthorization for MockUSDC.
 */
async function signTransferAuthorization(
  usdc,
  signer,
  to,
  value,
  validAfter,
  validBefore,
  nonce
) {
  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: await usdc.getAddress(),
  };

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const message = {
    from: signer.address,
    to: to,
    value: value,
    validAfter: validAfter,
    validBefore: validBefore,
    nonce: nonce,
  };

  const signature = await signer.signTypedData(domain, types, message);
  return signature;
}

/**
 * Generate a random stealth address (for testing — real generation uses EC math in SDK).
 */
function generateTestStealthAddress() {
  const wallet = ethers.Wallet.createRandom();
  return wallet.address;
}

/**
 * Generate a random nonce for EIP-3009.
 */
function generateNonce() {
  return ethers.hexlify(ethers.randomBytes(32));
}

/**
 * Generate a mock ephemeral public key (compressed, 33 bytes).
 */
function generateEphemeralPubKey() {
  const randomBytes = ethers.randomBytes(32);
  // Prefix with 0x02 (compressed pubkey prefix)
  return ethers.concat(["0x02", randomBytes]);
}

/**
 * Create payment params for testing.
 */
async function createPaymentParams(usdc, signer, routerAddress, amount, stealthAddress) {
  const nonce = generateNonce();
  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const ephemeralPubKey = generateEphemeralPubKey();
  const viewTag = Math.floor(Math.random() * 256);

  const signature = await signTransferAuthorization(
    usdc,
    signer,
    routerAddress,
    amount,
    validAfter,
    validBefore,
    nonce
  );

  return {
    from: signer.address,
    amount: amount,
    nonce: nonce,
    validAfter: validAfter,
    validBefore: validBefore,
    stealthAddress: stealthAddress || generateTestStealthAddress(),
    ephemeralPubKey: ephemeralPubKey,
    viewTag: viewTag,
    signature: signature,
  };
}

module.exports = {
  deployFullSystem,
  signTransferAuthorization,
  generateTestStealthAddress,
  generateNonce,
  generateEphemeralPubKey,
  createPaymentParams,
};
