import { ethers } from "ethers";
import { checkStealthAddress, computeViewTag } from "../utils/crypto";
import type { StealthPayment } from "../contracts/types";

const ERC20_BALANCE_ABI = ["function balanceOf(address) view returns (uint256)"];

/**
 * Stealth address scanner.
 * Scans StealthAnnouncer events to find payments addressed to you.
 *
 * Scanning algorithm:
 * 1. Query Announcement events from the StealthAnnouncer contract
 * 2. For each event, check the view tag (1 byte) for quick filtering
 * 3. If view tag matches, perform full ECDH check with viewing key
 * 4. Return matched payments with amounts and stealth addresses
 */
export class StealthScanner {
  private provider: ethers.JsonRpcProvider;
  private announcerAddress: string;
  private usdcAddress: string;
  private announcerAbi = [
    "event Announcement(uint256 indexed schemeId, address indexed stealthAddress, address indexed caller, bytes ephemeralPubKey, bytes metadata)",
    "function announcementCount() view returns (uint256)",
  ];

  constructor(rpcUrl: string, announcerAddress: string, usdcAddress?: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.announcerAddress = announcerAddress;
    // Default to Polygon Mainnet USDC if not provided
    this.usdcAddress = usdcAddress || "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
  }

  /**
   * Scan for stealth payments addressed to you.
   *
   * @param viewingPrivateKey Your viewing private key (for ECDH)
   * @param spendingPublicKey Your spending public key (for address derivation)
   * @param fromBlock Starting block number (default: latest - 10000)
   * @param toBlock Ending block number (default: latest)
   */
  async scanPayments(
    viewingPrivateKey: string,
    spendingPublicKey: string,
    fromBlock?: number,
    toBlock?: number
  ): Promise<StealthPayment[]> {
    const announcer = new ethers.Contract(
      this.announcerAddress,
      this.announcerAbi,
      this.provider
    );

    const latestBlock = await this.provider.getBlockNumber();
    const start = fromBlock ?? Math.max(0, latestBlock - 10000);
    const end = toBlock ?? latestBlock;

    // Query Announcement events (scheme ID = 1 for secp256k1)
    const filter = announcer.filters.Announcement(1n);
    const events = await announcer.queryFilter(filter, start, end);

    const matched: StealthPayment[] = [];

    for (const event of events) {
      const log = event as ethers.EventLog;
      const stealthAddress = log.args[1] as string;
      const caller = log.args[2] as string;
      const ephemeralPubKey = log.args[3] as string;
      const metadata = log.args[4] as string;

      // Extract view tag from metadata (first byte)
      const viewTag = parseInt(metadata.slice(2, 4), 16);

      // Quick check: compute expected view tag from ECDH
      try {
        const signingKey = new ethers.SigningKey(viewingPrivateKey);
        const sharedSecret = signingKey.computeSharedSecret(ephemeralPubKey);
        const sharedSecretHash = ethers.keccak256(sharedSecret);
        const expectedViewTag = computeViewTag(sharedSecretHash);

        // View tag filter (eliminates ~255/256 of false positives)
        if (viewTag !== expectedViewTag) continue;

        // Full address check
        const isForMe = checkStealthAddress(
          ephemeralPubKey,
          viewingPrivateKey,
          stealthAddress,
          spendingPublicKey
        );

        if (isForMe) {
          // Check USDC balance at stealth address
          const usdcBalance = await this.getUsdcBalance(stealthAddress);

          matched.push({
            stealthAddress,
            ephemeralPubKey,
            viewTag,
            amount: usdcBalance,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            caller,
          });
        }
      } catch {
        // Skip events that can't be processed
        continue;
      }
    }

    return matched;
  }

  /**
   * Get the total number of announcements.
   */
  async getAnnouncementCount(): Promise<number> {
    const announcer = new ethers.Contract(
      this.announcerAddress,
      this.announcerAbi,
      this.provider
    );
    return Number(await announcer.announcementCount());
  }

  /**
   * Get USDC balance at a given address.
   * Queries the actual USDC ERC-20 contract (not native balance).
   */
  private async getUsdcBalance(address: string): Promise<bigint> {
    try {
      const usdc = new ethers.Contract(
        this.usdcAddress,
        ERC20_BALANCE_ABI,
        this.provider
      );
      return await usdc.balanceOf(address);
    } catch {
      return 0n;
    }
  }
}
