const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  StealthPay402 — Full Deployment");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Network:  ${network.name} (Chain ${chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH/POL`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const addresses = {};

  // ── Step 1: USDC ──
  let usdcAddress;
  if (chainId === 137n) {
    // Polygon Mainnet — use real USDC
    usdcAddress = process.env.USDC_ADDRESS || "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
    console.log("1. Using real USDC:", usdcAddress);
  } else {
    // Testnet / Local — deploy MockUSDC
    console.log("1. Deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
    console.log("   MockUSDC deployed:", usdcAddress);
  }
  addresses.USDC = usdcAddress;

  // ── Step 2: StealthAnnouncer ──
  console.log("2. Deploying StealthAnnouncer...");
  const StealthAnnouncer = await ethers.getContractFactory("StealthAnnouncer");
  const announcer = await StealthAnnouncer.deploy();
  await announcer.waitForDeployment();
  addresses.StealthAnnouncer = await announcer.getAddress();
  console.log("   StealthAnnouncer deployed:", addresses.StealthAnnouncer);

  // ── Step 3: StealthMetaRegistry ──
  console.log("3. Deploying StealthMetaRegistry...");
  const StealthMetaRegistry = await ethers.getContractFactory("StealthMetaRegistry");
  const metaRegistry = await StealthMetaRegistry.deploy();
  await metaRegistry.waitForDeployment();
  addresses.StealthMetaRegistry = await metaRegistry.getAddress();
  console.log("   StealthMetaRegistry deployed:", addresses.StealthMetaRegistry);

  // ── Step 4: FeeVault ──
  console.log("4. Deploying FeeVault...");
  const FeeVault = await ethers.getContractFactory("FeeVault");
  const feeVault = await FeeVault.deploy(usdcAddress, deployer.address); // deployer as initial treasury
  await feeVault.waitForDeployment();
  addresses.FeeVault = await feeVault.getAddress();
  console.log("   FeeVault deployed:", addresses.FeeVault);

  // ── Step 5: AgentRegistry ──
  console.log("5. Deploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  addresses.AgentRegistry = await agentRegistry.getAddress();
  console.log("   AgentRegistry deployed:", addresses.AgentRegistry);

  // ── Step 6: ComplianceGate ──
  console.log("6. Deploying ComplianceGate...");
  const ComplianceGate = await ethers.getContractFactory("ComplianceGate");
  const complianceGate = await ComplianceGate.deploy();
  await complianceGate.waitForDeployment();
  addresses.ComplianceGate = await complianceGate.getAddress();
  console.log("   ComplianceGate deployed:", addresses.ComplianceGate);

  // ── Step 7: StealthPaymentRouter ──
  console.log("7. Deploying StealthPaymentRouter...");
  const StealthPaymentRouter = await ethers.getContractFactory("StealthPaymentRouter");
  const router = await StealthPaymentRouter.deploy(
    usdcAddress,
    addresses.StealthAnnouncer,
    addresses.FeeVault
  );
  await router.waitForDeployment();
  addresses.StealthPaymentRouter = await router.getAddress();
  console.log("   StealthPaymentRouter deployed:", addresses.StealthPaymentRouter);

  // ── Step 8: Link contracts ──
  console.log("\n8. Linking contracts...");
  let tx;

  tx = await router.setAgentRegistry(addresses.AgentRegistry);
  await tx.wait();
  console.log("   Router → AgentRegistry linked");

  tx = await router.setComplianceGate(addresses.ComplianceGate);
  await tx.wait();
  console.log("   Router → ComplianceGate linked");

  tx = await agentRegistry.setRouter(addresses.StealthPaymentRouter);
  await tx.wait();
  console.log("   AgentRegistry → Router linked");

  // ── Step 9: Deploy CrossChainRouter (if applicable) ──
  if (chainId !== 31337n) {
    console.log("9. Deploying CrossChainRouter...");
    // AggLayer bridge addresses by chain
    // Amoy: PolygonZkEVMBridgeV2 proxy on Amoy testnet
    // Mainnet: PolygonZkEVMBridgeV2 proxy on Polygon PoS
    const bridgeAddresses = {
      80002n: "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582", // Amoy bridge
      137n: "0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe",   // Polygon PoS bridge
      2442n: "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582",  // Cardona bridge
    };
    const bridgeAddress = bridgeAddresses[chainId] || "0x0000000000000000000000000000000000000001";
    const CrossChainRouter = await ethers.getContractFactory("CrossChainRouter");
    const crossChainRouter = await CrossChainRouter.deploy(
      usdcAddress,
      bridgeAddress,
      addresses.StealthPaymentRouter
    );
    await crossChainRouter.waitForDeployment();
    addresses.CrossChainRouter = await crossChainRouter.getAddress();
    console.log("   CrossChainRouter deployed:", addresses.CrossChainRouter);
  } else {
    console.log("9. Skipping CrossChainRouter (local network)");
  }

  // ── Summary ──
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE — Contract Addresses");
  console.log("═══════════════════════════════════════════════════════════");

  const explorerBase = chainId === 137n
    ? "https://polygonscan.com/address/"
    : chainId === 80002n
    ? "https://amoy.polygonscan.com/address/"
    : chainId === 2442n
    ? "https://cardona-zkevm.polygonscan.com/address/"
    : "";

  for (const [name, addr] of Object.entries(addresses)) {
    const link = explorerBase ? `${explorerBase}${addr}` : addr;
    console.log(`  ${name.padEnd(25)} → ${addr}`);
    if (explorerBase) console.log(`  ${"".padEnd(25)}   ${link}`);
  }

  console.log("═══════════════════════════════════════════════════════════\n");

  // ── Save addresses ──
  const outputPath = path.join(__dirname, "..", "deployments", `${network.name}-${chainId}.json`);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const deployment = {
    network: network.name,
    chainId: Number(chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    addresses,
  };

  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  console.log(`Addresses saved to: ${outputPath}`);

  // Also update SDK addresses file
  const sdkAddressesPath = path.join(__dirname, "..", "sdk", "src", "contracts", "addresses.ts");
  const sdkContent = `// Auto-generated by deploy script — ${new Date().toISOString()}
export const DEPLOYED_ADDRESSES: Record<number, Record<string, string>> = {
  ${Number(chainId)}: ${JSON.stringify(addresses, null, 4)},
};

export function getAddresses(chainId: number) {
  return DEPLOYED_ADDRESSES[chainId] || null;
}
`;
  fs.writeFileSync(sdkAddressesPath, sdkContent);
  console.log(`SDK addresses updated: ${sdkAddressesPath}`);

  // Also update frontend contract addresses
  const frontendAddressesPath = path.join(__dirname, "..", "frontend", "src", "lib", "contracts.ts");
  if (fs.existsSync(frontendAddressesPath)) {
    let frontendContent = fs.readFileSync(frontendAddressesPath, "utf-8");
    // Update addresses for this chain ID
    const chainKey = Number(chainId);
    for (const [name, addr] of Object.entries(addresses)) {
      const regex = new RegExp(`(${chainKey}:[\\s\\S]*?${name}:\\s*)"[^"]*"`, "m");
      if (frontendContent.match(regex)) {
        frontendContent = frontendContent.replace(regex, `$1"${addr}"`);
      }
    }
    fs.writeFileSync(frontendAddressesPath, frontendContent);
    console.log(`Frontend addresses updated: ${frontendAddressesPath}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
