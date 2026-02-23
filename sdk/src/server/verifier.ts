import { ethers } from "ethers";

/**
 * On-chain payment verifier.
 * Checks the StealthPaymentRouter contract to confirm a payment was processed.
 */
export class PaymentVerifier {
  private provider: ethers.JsonRpcProvider;
  private routerAddress: string;
  private routerAbi = [
    "function processed(bytes32) view returns (bool)",
    "function platformFeeBps() view returns (uint256)",
    "event PaymentProcessed(address indexed from, address indexed stealthAddress, uint256 amount, uint256 fee, bytes32 nonce)",
  ];

  constructor(rpcUrl: string, routerAddress: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.routerAddress = routerAddress;
  }

  /**
   * Check if a payment nonce has been processed.
   */
  async isProcessed(nonce: string): Promise<boolean> {
    const router = new ethers.Contract(this.routerAddress, this.routerAbi, this.provider);
    return router.processed(nonce);
  }

  /**
   * Get payment details from a transaction hash.
   */
  async getPaymentFromTx(txHash: string): Promise<{
    from: string;
    stealthAddress: string;
    amount: bigint;
    fee: bigint;
    nonce: string;
  } | null> {
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) return null;

    const iface = new ethers.Interface(this.routerAbi);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed && parsed.name === "PaymentProcessed") {
          return {
            from: parsed.args[0],
            stealthAddress: parsed.args[1],
            amount: parsed.args[2],
            fee: parsed.args[3],
            nonce: parsed.args[4],
          };
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  /**
   * Get the current platform fee in basis points.
   */
  async getPlatformFee(): Promise<number> {
    const router = new ethers.Contract(this.routerAddress, this.routerAbi, this.provider);
    const fee = await router.platformFeeBps();
    return Number(fee);
  }
}
