import { ethers } from "ethers";
import { generateStealthAddress } from "../utils/crypto";
import { signTransferAuthorization, encodePaymentHeader } from "../utils/eip3009";
import type { PaymentRequirement } from "../contracts/types";

/**
 * AI Agent payment handler for x402 stealth payments.
 *
 * Handles the full x402 client-side flow:
 * 1. Fetch API endpoint
 * 2. If 402 → parse payment instructions
 * 3. Generate stealth address from receiver's meta-address
 * 4. Sign EIP-3009 transferWithAuthorization for USDC
 * 5. Retry request with X-PAYMENT header
 * 6. Return API response
 */

export interface AgentPaymentOptions {
  /** Agent's wallet (ethers.Wallet with private key) */
  wallet: ethers.Wallet;
  /** Use stealth addresses for privacy (default: true) */
  privatePayment?: boolean;
  /** Maximum payment amount in USDC (safety limit) */
  maxPayment?: string;
  /** Chain ID override */
  chainId?: number;
  /** USDC contract address */
  usdcAddress?: string;
  /** StealthPaymentRouter address */
  routerAddress?: string;
}

/**
 * Make a paid API request using x402 protocol with stealth addresses.
 *
 * Usage:
 * ```
 * const response = await payForAccess('https://api.example.com/data', {
 *   wallet: agentWallet,
 *   privatePayment: true,
 * });
 * console.log(response.data);
 * ```
 */
export async function payForAccess(
  url: string,
  options: AgentPaymentOptions
): Promise<{ status: number; data: any; paymentInfo?: any }> {
  const {
    wallet,
    privatePayment = true,
    maxPayment = "10.0",
    chainId,
    usdcAddress,
    routerAddress,
  } = options;

  // Step 1: Initial request
  const initialResponse = await fetch(url);

  // If not 402, return directly
  if (initialResponse.status !== 402) {
    return {
      status: initialResponse.status,
      data: await initialResponse.json().catch(() => null),
    };
  }

  // Step 2: Parse 402 payment instructions
  let paymentInfo: { payment: PaymentRequirement };
  try {
    paymentInfo = (await initialResponse.json()) as { payment: PaymentRequirement };
  } catch {
    throw new Error("Invalid 402 response: could not parse JSON body");
  }
  const requirement: PaymentRequirement = paymentInfo.payment;

  if (!requirement || !requirement.amount || !requirement.receiver) {
    throw new Error("Invalid 402 response: missing payment instructions (amount/receiver)");
  }

  // Step 3: Safety check — don't overpay
  const requiredAmount = parseFloat(requirement.amount);
  const maxAmount = parseFloat(maxPayment);
  if (requiredAmount > maxAmount) {
    throw new Error(
      `Payment ${requirement.amount} exceeds max ${maxPayment} USDC`
    );
  }

  // Step 4: Generate stealth address (if private payment enabled)
  let stealthAddress: string;
  let ephemeralPublicKey: string;
  let viewTag: number;

  if (privatePayment && requirement.receiverMetaAddress) {
    const stealth = generateStealthAddress(requirement.receiverMetaAddress);
    stealthAddress = stealth.stealthAddress;
    ephemeralPublicKey = stealth.ephemeralPublicKey;
    viewTag = stealth.viewTag;
  } else {
    // Non-private: use receiver address directly
    stealthAddress = requirement.receiver;
    ephemeralPublicKey = "0x" + "00".repeat(33);
    viewTag = 0;
  }

  // Step 5: Sign EIP-3009 authorization
  const targetChain = chainId || requirement.chain;
  const targetUsdc = usdcAddress || requirement.token;
  const targetRouter = routerAddress || requirement.facilitator;
  const amount = ethers.parseUnits(requirement.amount, 6);

  const auth = await signTransferAuthorization({
    signer: wallet,
    usdcAddress: targetUsdc,
    to: targetRouter,
    value: amount,
    chainId: targetChain,
  });

  // Step 6: Encode payment header
  const paymentHeader = encodePaymentHeader({
    from: wallet.address,
    amount: amount.toString(),
    nonce: auth.nonce,
    validAfter: auth.validAfter,
    validBefore: auth.validBefore,
    stealthAddress,
    ephemeralPubKey: ephemeralPublicKey,
    viewTag,
    signature: auth.signature,
  });

  // Step 7: Retry with payment
  const paidResponse = await fetch(url, {
    headers: {
      "X-PAYMENT": paymentHeader,
      "Content-Type": "application/json",
    },
  });

  return {
    status: paidResponse.status,
    data: await paidResponse.json().catch(() => null),
    paymentInfo: {
      amount: requirement.amount,
      stealthAddress,
      nonce: auth.nonce,
      private: privatePayment,
    },
  };
}
