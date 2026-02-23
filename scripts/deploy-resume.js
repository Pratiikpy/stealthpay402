const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Resume deployment from where deploy-all.js left off.
 * Uses already-deployed contract addresses and only deploys what's missing.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  StealthPay402 — RESUME Deployment");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Network:  ${network.name} (Chain ${chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} POL`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Already deployed contracts from previous run
  const addresses = {
    USDC: "0xfb2835BcEdBCDB079461Fc249A7586732c9604d6",
    StealthAnnouncer: "0x4330E0E861BF47e15c5c67eF10FF5ef4fDa18BB9",
    StealthMetaRegistry: "0x0315417DfEC2aBa840B3d73b45DCF8F49FE8E9C4",
    FeeVault: "0x0F0165ebaf76eAaf58fdfe9deae8b65a013CB373",
  };

  console.log("Previously deployed:");
  for (const [name, addr] of Object.entries(addresses)) {
    console.log(`  ${name.padEnd(25)} → ${addr}`);
  }
  console.log("");

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
    addresses.USDC,
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

  // ── Step 9: CrossChainRouter ──
  const balance = await ethers.provider.getBalance(deployer.address);
  if (balance > ethers.parseEther("0.03")) {
    console.log("9. Deploying CrossChainRouter...");
    const bridgeAddresses = {
      80002n: "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582",
      137n: "0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe",
      2442n: "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582",
    };
    const bridgeAddress = bridgeAddresses[chainId] || "0x0000000000000000000000000000000000000001";
    const CrossChainRouter = await ethers.getContractFactory("CrossChainRouter");
    const crossChainRouter = await CrossChainRouter.deploy(
      addresses.USDC,
      bridgeAddress,
      addresses.StealthPaymentRouter
    );
    await crossChainRouter.waitForDeployment();
    addresses.CrossChainRouter = await crossChainRouter.getAddress();
    console.log("   CrossChainRouter deployed:", addresses.CrossChainRouter);
  } else {
    console.log("9. Skipping CrossChainRouter (insufficient balance — deploy later)");
  }

  // ── Summary ──
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE — Contract Addresses");
  console.log("═══════════════════════════════════════════════════════════");

  const explorerBase = chainId === 137n
    ? "https://polygonscan.com/address/"
    : chainId === 80002n
    ? "https://amoy.polygonscan.com/address/"
    : "";

  for (const [name, addr] of Object.entries(addresses)) {
    console.log(`  ${name.padEnd(25)} → ${addr}`);
    if (explorerBase) console.log(`  ${"".padEnd(25)}   ${explorerBase}${addr}`);
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

  // Update SDK addresses
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

  // Update frontend addresses
  const frontendAddressesPath = path.join(__dirname, "..", "frontend", "src", "lib", "contracts.ts");
  if (fs.existsSync(frontendAddressesPath)) {
    let frontendContent = fs.readFileSync(frontendAddressesPath, "utf-8");
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

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`\nRemaining balance: ${ethers.formatEther(finalBalance)} POL`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
