const { run, network, ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const chainId = (await ethers.provider.getNetwork()).chainId;
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}-${chainId}.json`);

  if (!fs.existsSync(deploymentPath)) {
    console.error(`No deployment found at ${deploymentPath}`);
    console.error("Run deploy-all.js first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const { addresses } = deployment;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  StealthPay402 — Contract Verification");
  console.log(`  Network: ${network.name} (Chain ${chainId})`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const contracts = [];

  // Only verify MockUSDC on testnets (not real USDC on mainnet)
  if (chainId !== 137n) {
    contracts.push({
      name: "MockUSDC",
      address: addresses.USDC,
      constructorArguments: [],
    });
  }

  contracts.push(
    {
      name: "StealthAnnouncer",
      address: addresses.StealthAnnouncer,
      constructorArguments: [],
    },
    {
      name: "StealthMetaRegistry",
      address: addresses.StealthMetaRegistry,
      constructorArguments: [],
    },
    {
      name: "FeeVault",
      address: addresses.FeeVault,
      constructorArguments: [addresses.USDC, deployment.deployer],
    },
    {
      name: "AgentRegistry",
      address: addresses.AgentRegistry,
      constructorArguments: [],
    },
    {
      name: "ComplianceGate",
      address: addresses.ComplianceGate,
      constructorArguments: [],
    },
    {
      name: "StealthPaymentRouter",
      address: addresses.StealthPaymentRouter,
      constructorArguments: [addresses.USDC, addresses.StealthAnnouncer, addresses.FeeVault],
    }
  );

  if (addresses.CrossChainRouter) {
    const bridgeAddresses = {
      80002: "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582",
      137: "0x2a3DD3EB832aF982ec71669E178424b10Dca2EDe",
      2442: "0x528e26b25a34a4A5d0dbDa1d57D318153d2ED582",
    };
    contracts.push({
      name: "CrossChainRouter",
      address: addresses.CrossChainRouter,
      constructorArguments: [
        addresses.USDC,
        bridgeAddresses[Number(chainId)] || "0x0000000000000000000000000000000000000001",
        addresses.StealthPaymentRouter,
      ],
    });
  }

  for (const contract of contracts) {
    try {
      console.log(`Verifying ${contract.name} at ${contract.address}...`);
      await run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.constructorArguments,
      });
      console.log(`  ✅ ${contract.name} verified\n`);
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log(`  ✅ ${contract.name} already verified\n`);
      } else {
        console.log(`  ❌ ${contract.name} verification failed: ${error.message}\n`);
      }
    }
  }

  console.log("Verification complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
