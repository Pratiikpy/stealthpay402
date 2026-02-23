import { ethers } from "ethers";
import { decodePaymentHeader } from "../utils/eip3009";
import type { PaymentRequirement } from "../contracts/types";

/**
 * Express/Connect middleware options for x402 payment gating.
 */
export interface StealthPay402Options {
  /** Price in USDC (human-readable, e.g., "0.01") */
  price: string;
  /** Token symbol (currently only "USDC") */
  token?: string;
  /** Chain ID (137 = Polygon Mainnet, 80002 = Amoy) */
  chain?: number;
  /** StealthPaymentRouter contract address */
  routerAddress: string;
  /** RPC URL for on-chain verification */
  rpcUrl?: string;
  /** Receiver's stealth meta-address (for stealth payment generation) */
  receiverMetaAddress?: string;
  /** Description of the endpoint (shown in 402 response) */
  description?: string;
}

/**
 * x402 payment middleware for Express/Connect servers.
 *
 * Usage:
 * ```
 * import { stealthPay402 } from '@stealthpay402/sdk/server';
 *
 * app.get('/api/data', stealthPay402({
 *   price: '0.01',
 *   routerAddress: '0x...',
 *   chain: 137,
 * }), (req, res) => {
 *   res.json({ data: "premium content" });
 * });
 * ```
 *
 * Flow:
 * 1. Check for X-PAYMENT header
 * 2. If missing → return 402 with payment instructions JSON
 * 3. If present → decode, verify on-chain payment, call next()
 */
export function stealthPay402(options: StealthPay402Options) {
  const {
    price,
    token = "USDC",
    chain = 137,
    routerAddress,
    rpcUrl,
    receiverMetaAddress,
    description,
  } = options;

  return async (req: any, res: any, next: any) => {
    const paymentHeader = req.headers["x-payment"];

    if (!paymentHeader) {
      // Return 402 Payment Required with instructions
      const requirement: PaymentRequirement = {
        amount: price,
        token,
        chain,
        receiver: routerAddress,
        facilitator: routerAddress,
        receiverMetaAddress,
        description: description || `Pay ${price} ${token} to access this endpoint`,
      };

      res.status(402).json({
        status: 402,
        message: "Payment Required",
        payment: requirement,
        x402Version: "1.0",
      });
      return;
    }

    try {
      // Decode the payment header
      const payment = decodePaymentHeader(paymentHeader as string);

      // Verify payment amount matches required amount
      const requiredAmount = ethers.parseUnits(price, 6); // USDC has 6 decimals
      const paidAmount = BigInt(payment.amount);

      if (paidAmount < requiredAmount) {
        res.status(402).json({
          status: 402,
          message: "Insufficient payment",
          required: price,
          paid: ethers.formatUnits(paidAmount, 6),
        });
        return;
      }

      // Verify on-chain that the payment was processed
      if (rpcUrl) {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const routerAbi = [
          "function processed(bytes32) view returns (bool)",
          "function platformFeeBps() view returns (uint256)",
          "function usdc() view returns (address)",
          "function feeVault() view returns (address)",
          "event PaymentProcessed(address indexed from, address indexed stealthAddress, uint256 amount, uint256 fee, bytes32 nonce)",
        ];
        const router = new ethers.Contract(routerAddress, routerAbi, provider);
        const isProcessed = await router.processed(payment.nonce);

        if (!isProcessed) {
          res.status(402).json({
            status: 402,
            message: "Payment not yet confirmed on-chain",
            nonce: payment.nonce,
          });
          return;
        }
      }

      // Payment verified — attach payment info to request and proceed
      (req as any).payment = {
        from: payment.from,
        amount: payment.amount,
        stealthAddress: payment.stealthAddress,
        nonce: payment.nonce,
        verified: true,
      };

      next();
    } catch (error: any) {
      res.status(400).json({
        status: 400,
        message: "Invalid payment header",
        error: error.message,
      });
    }
  };
}
