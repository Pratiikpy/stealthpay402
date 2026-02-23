import { ethers } from "ethers";
import { generateStealthKeys } from "../utils/crypto";

/**
 * Agent wallet management utilities.
 * Helps AI agents manage their payment wallets and stealth keys.
 */

/**
 * Create a new agent wallet with stealth keys.
 */
export function createAgentWallet(provider?: ethers.Provider): {
  wallet: ethers.HDNodeWallet;
  stealthKeys: ReturnType<typeof generateStealthKeys>;
} {
  const wallet = ethers.Wallet.createRandom(provider);
  const stealthKeys = generateStealthKeys();

  return { wallet, stealthKeys };
}

/**
 * Load an agent wallet from a private key.
 */
export function loadAgentWallet(
  privateKey: string,
  rpcUrl?: string
): ethers.Wallet {
  if (rpcUrl) {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return new ethers.Wallet(privateKey, provider);
  }
  return new ethers.Wallet(privateKey);
}

/**
 * Check USDC balance for an agent wallet.
 */
export async function getUsdcBalance(
  walletAddress: string,
  usdcAddress: string,
  rpcUrl: string
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const usdc = new ethers.Contract(
    usdcAddress,
    ["function balanceOf(address) view returns (uint256)"],
    provider
  );
  const balance = await usdc.balanceOf(walletAddress);
  return ethers.formatUnits(balance, 6);
}
