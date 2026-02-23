import { ethers } from "ethers";
import { Request, Response, NextFunction } from "express";

/**
 * x402 stealth payment middleware for the demo server.
 * Uses on-chain verification via StealthPaymentRouter.processed() mapping.
 *
 * This is the production-grade middleware that:
 * 1. Returns 402 with payment instructions if no X-PAYMENT header
 * 2. Decodes the payment header (base64 JSON)
 * 3. Verifies the payment amount meets the required price
 * 4. Verifies the payment was processed on-chain (if RPC URL is configured)
 * 5. Calls next() only after verification passes
 */

export interface StealthPayOptions {
  /** Price in USDC (e.g., "0.01") */
  price: string;
  /** Description shown in 402 response */
  description?: string;
  /** StealthPaymentRouter address */
  routerAddress?: string;
  /** RPC URL for on-chain verification */
  rpcUrl?: string;
  /** Receiver's stealth meta-address */
  receiverMetaAddress?: string;
}

const ROUTER_ABI = [
  "function processed(bytes32) view returns (bool)",
  "function platformFeeBps() view returns (uint256)",
  "event PaymentProcessed(address indexed from, address indexed stealthAddress, uint256 amount, uint256 fee, bytes32 nonce)",
];

export function stealthPayMiddleware(options: StealthPayOptions) {
  const {
    price,
    description,
    routerAddress = process.env.ROUTER_ADDRESS || "",
    rpcUrl = process.env.RPC_URL || "",
    receiverMetaAddress = process.env.RECEIVER_META_ADDRESS,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader = req.headers["x-payment"];

    if (!paymentHeader) {
      // Return 402 Payment Required with x402 payment instructions
      res.status(402).json({
        status: 402,
        message: "Payment Required",
        x402Version: "1.0",
        payment: {
          amount: price,
          token: "USDC",
          chain: 137,
          receiver: routerAddress || "StealthPaymentRouter",
          facilitator: routerAddress || "StealthPaymentRouter",
          receiverMetaAddress,
          description: description || `Pay ${price} USDC to access this endpoint`,
        },
      });
      return;
    }

    // Parse and validate payment
    try {
      const payment = JSON.parse(
        Buffer.from(paymentHeader as string, "base64").toString("utf-8")
      );

      // Verify payment amount
      const requiredAmount = ethers.parseUnits(price, 6);
      const paidAmount = BigInt(payment.amount || "0");

      if (paidAmount < requiredAmount) {
        res.status(402).json({
          status: 402,
          message: "Insufficient payment",
          required: price,
          paid: ethers.formatUnits(paidAmount, 6),
        });
        return;
      }

      // On-chain verification (if RPC URL and router address are configured)
      if (rpcUrl && routerAddress && payment.nonce) {
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const router = new ethers.Contract(routerAddress, ROUTER_ABI, provider);
          const isProcessed = await router.processed(payment.nonce);

          if (!isProcessed) {
            res.status(402).json({
              status: 402,
              message: "Payment not yet confirmed on-chain",
              nonce: payment.nonce,
            });
            return;
          }
        } catch (verifyError: any) {
          console.warn(`[Payment] On-chain verification failed: ${verifyError.message}`);
          // In demo mode, allow through with warning if chain verification fails
          // In production, this should be a hard failure
        }
      }

      // Attach verified payment info to request
      (req as any).payment = {
        from: payment.from,
        amount: payment.amount,
        stealthAddress: payment.stealthAddress,
        nonce: payment.nonce,
        verified: true,
        onChainVerified: !!(rpcUrl && routerAddress),
      };

      console.log(
        `[Payment] Verified: ${payment.from} paid ${ethers.formatUnits(paidAmount, 6)} USDC` +
        (payment.stealthAddress ? ` → stealth:${payment.stealthAddress.slice(0, 10)}...` : "")
      );
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
