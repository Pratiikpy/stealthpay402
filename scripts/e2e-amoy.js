/**
 * StealthPay402 — End-to-End Test on Polygon Amoy
 *
 * This script tests the full x402 + stealth payment flow on live Amoy testnet:
 * 1. Mint MockUSDC to deployer
 * 2. Sign EIP-3009 transferWithAuthorization
 * 3. Process payment via StealthPaymentRouter
 * 4. Verify fee in FeeVault
 * 5. Verify USDC arrived at stealth address
 * 6. Verify Announcement event emitted
 *
 * Usage: npx hardhat run scripts/e2e-amoy.js --network polygonAmoy
 */

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = (await ethers.provider.getNetwork()).chainId;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  StealthPay402 — E2E Test on Amoy");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Network:  ${network.name} (Chain ${chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MATIC`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Load deployment addresses
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network.name}-${chainId}.json`);
  if (!fs.existsSync(deploymentPath)) {
    console.error("ERROR: No deployment found at", deploymentPath);
    console.error("Run `npx hardhat run scripts/deploy-all.js --network polygonAmoy` first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const addr = deployment.addresses;

  console.log("Loaded addresses from:", deploymentPath);
  console.log("  MockUSDC:", addr.USDC);
  console.log("  Router:", addr.StealthPaymentRouter);
  console.log("  FeeVault:", addr.FeeVault);
  console.log("  Announcer:", addr.StealthAnnouncer);
  console.log();

  // Connect to contracts
  const usdc = await ethers.getContractAt("MockUSDC", addr.USDC);
  const router = await ethers.getContractAt("StealthPaymentRouter", addr.StealthPaymentRouter);
  const announcer = await ethers.getContractAt("StealthAnnouncer", addr.StealthAnnouncer);
  const feeVault = await ethers.getContractAt("FeeVault", addr.FeeVault);

  // ─── Step 1: Mint MockUSDC ───
  console.log("Step 1: Minting 100 MockUSDC to deployer...");
  const mintAmount = ethers.parseUnits("100", 6);
  const mintTx = await usdc.mint(deployer.address, mintAmount);
  await mintTx.wait();
  const balance = await usdc.balanceOf(deployer.address);
  console.log(`  Balance: ${ethers.formatUnits(balance, 6)} USDC ✓\n`);

  // ─── Step 2: Generate stealth address ───
  console.log("Step 2: Generating stealth address...");
  const stealthWallet = ethers.Wallet.createRandom();
  const stealthAddress = stealthWallet.address;
  const ephemeralWallet = ethers.Wallet.createRandom();
  const ephemeralPubKey = ethers.SigningKey.computePublicKey(ephemeralWallet.privateKey, true);
  const viewTag = Math.floor(Math.random() * 256);
  console.log(`  Stealth address: ${stealthAddress}`);
  console.log(`  Ephemeral pubkey: ${ephemeralPubKey.slice(0, 20)}...`);
  console.log(`  View tag: ${viewTag} ✓\n`);

  // ─── Step 3: Sign EIP-3009 authorization ───
  console.log("Step 3: Signing EIP-3009 transferWithAuthorization...");
  const paymentAmount = ethers.parseUnits("10", 6); // 10 USDC
  const nonce = ethers.hexlify(ethers.randomBytes(32));
  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + 3600;

  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: chainId,
    verifyingContract: addr.USDC,
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
    from: deployer.address,
    to: addr.StealthPaymentRouter,
    value: paymentAmount,
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await deployer.signTypedData(domain, types, message);
  console.log(`  Signature: ${signature.slice(0, 30)}...`);
  console.log(`  Nonce: ${nonce.slice(0, 20)}... ✓\n`);

  // ─── Step 4: Process payment ───
  console.log("Step 4: Processing payment via StealthPaymentRouter...");
  const params = {
    from: deployer.address,
    amount: paymentAmount,
    nonce,
    validAfter,
    validBefore,
    stealthAddress,
    ephemeralPubKey,
    viewTag,
    signature,
  };

  const feeBps = await router.platformFeeBps();
  const expectedFee = (paymentAmount * feeBps) / 10000n;
  const expectedRecipient = paymentAmount - expectedFee;

  console.log(`  Payment: ${ethers.formatUnits(paymentAmount, 6)} USDC`);
  console.log(`  Fee: ${ethers.formatUnits(expectedFee, 6)} USDC (${Number(feeBps) / 100}%)`);
  console.log(`  To stealth: ${ethers.formatUnits(expectedRecipient, 6)} USDC`);

  const tx = await router.processPayment(params);
  const receipt = await tx.wait();
  console.log(`  Tx hash: ${receipt.hash}`);
  console.log(`  Gas used: ${receipt.gasUsed.toString()}`);
  console.log(`  Block: ${receipt.blockNumber} ✓\n`);

  // ─── Step 5: Verify results ───
  console.log("Step 5: Verifying on-chain results...");

  // Check stealth address balance
  const stealthBalance = await usdc.balanceOf(stealthAddress);
  console.log(`  Stealth balance: ${ethers.formatUnits(stealthBalance, 6)} USDC (expected: ${ethers.formatUnits(expectedRecipient, 6)})`);
  const stealthOk = stealthBalance === expectedRecipient;
  console.log(`  ${stealthOk ? "✓ PASS" : "✗ FAIL"}`);

  // Check fee vault balance
  const vaultBalance = await usdc.balanceOf(addr.FeeVault);
  console.log(`  Vault balance: ${ethers.formatUnits(vaultBalance, 6)} USDC (expected: ${ethers.formatUnits(expectedFee, 6)})`);
  const vaultOk = vaultBalance >= expectedFee;
  console.log(`  ${vaultOk ? "✓ PASS" : "✗ FAIL"}`);

  // Check nonce was processed
  const processed = await router.processed(nonce);
  console.log(`  Nonce processed: ${processed}`);
  console.log(`  ${processed ? "✓ PASS" : "✗ FAIL"}`);

  // Check announcement count
  const announcementCount = await announcer.announcementCount();
  console.log(`  Announcement count: ${announcementCount}`);
  const announcerOk = announcementCount > 0n;
  console.log(`  ${announcerOk ? "✓ PASS" : "✗ FAIL"}`);

  // ─── Summary ───
  const allPass = stealthOk && vaultOk && processed && announcerOk;
  console.log("\n═══════════════════════════════════════════════════════════");
  if (allPass) {
    console.log("  ✓ E2E TEST PASSED — Full x402 + stealth payment verified!");
  } else {
    console.log("  ✗ E2E TEST FAILED — See errors above");
  }
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Tx: https://amoy.polygonscan.com/tx/${receipt.hash}`);
  console.log(`  Stealth: https://amoy.polygonscan.com/address/${stealthAddress}`);
  console.log(`  Router: https://amoy.polygonscan.com/address/${addr.StealthPaymentRouter}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  if (!allPass) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
