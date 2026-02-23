const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}-${chainId}.json`);

  if (!fs.existsSync(deploymentPath)) {
    console.error("No deployment found. Run deploy-all.js first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const { addresses } = deployment;
  const [deployer, agent1, agent2] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  StealthPay402 — Seed Data");
  console.log(`  Network: ${network.name} (Chain ${chainId})`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Get contract instances
  const agentRegistry = await ethers.getContractAt("AgentRegistry", addresses.AgentRegistry);
  const metaRegistry = await ethers.getContractAt("StealthMetaRegistry", addresses.StealthMetaRegistry);

  // Register test agents
  const agents = [
    { signer: agent1, name: "Weather Data Agent" },
    { signer: agent2, name: "Price Feed Agent" },
  ];

  for (const { signer, name } of agents) {
    try {
      const metadataHash = ethers.id(name);
      const tx = await agentRegistry.connect(signer).registerAgent(metadataHash);
      await tx.wait();
      console.log(`Registered agent: ${name} (${signer.address})`);
    } catch (e) {
      console.log(`Agent ${name} may already be registered: ${e.message.slice(0, 80)}`);
    }
  }

  // Register stealth meta-addresses for deployer (as a test recipient)
  try {
    const spendingPubKey = ethers.concat(["0x02", ethers.randomBytes(32)]);
    const viewingPubKey = ethers.concat(["0x03", ethers.randomBytes(32)]);
    const metaAddress = ethers.concat([spendingPubKey, viewingPubKey]);

    const tx = await metaRegistry.registerKeys(1, metaAddress);
    await tx.wait();
    console.log(`Registered stealth meta-address for deployer: ${deployer.address}`);
  } catch (e) {
    console.log(`Meta-address may already exist: ${e.message.slice(0, 80)}`);
  }

  // If on testnet, mint MockUSDC to test agents
  if (chainId !== 137n) {
    try {
      const usdc = await ethers.getContractAt("MockUSDC", addresses.USDC);
      const mintAmount = ethers.parseUnits("10000", 6); // 10k USDC each

      for (const { signer, name } of agents) {
        const tx = await usdc.mint(signer.address, mintAmount);
        await tx.wait();
        console.log(`Minted ${ethers.formatUnits(mintAmount, 6)} USDC to ${name}`);
      }
    } catch (e) {
      console.log(`MockUSDC minting failed: ${e.message.slice(0, 80)}`);
    }
  }

  console.log("\nSeed data complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
