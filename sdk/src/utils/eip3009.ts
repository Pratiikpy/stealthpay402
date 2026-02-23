import { ethers } from "ethers";

/**
 * EIP-3009 transferWithAuthorization signature helpers.
 *
 * EIP-3009 enables gasless token transfers by allowing the token holder
 * to sign an authorization off-chain. Anyone can then submit that signature
 * on-chain to execute the transfer. This is how x402 payments work:
 *
 * 1. AI agent signs a USDC transfer authorization
 * 2. The facilitator (or the agent itself) submits it to the StealthPaymentRouter
 * 3. The router calls USDC.transferWithAuthorization()
 * 4. USDC moves from agent → router without the agent paying gas
 */

const TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
  "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)";

/**
 * Sign an EIP-3009 transferWithAuthorization for USDC.
 */
export async function signTransferAuthorization(params: {
  signer: ethers.Signer;
  usdcAddress: string;
  to: string;
  value: bigint;
  validAfter?: number;
  validBefore?: number;
  nonce?: string;
  chainId: number;
}): Promise<{
  signature: string;
  nonce: string;
  validAfter: number;
  validBefore: number;
}> {
  const {
    signer,
    usdcAddress,
    to,
    value,
    validAfter = 0,
    validBefore = Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    nonce = ethers.hexlify(ethers.randomBytes(32)),
    chainId,
  } = params;

  const domain: ethers.TypedDataDomain = {
    name: "USD Coin",
    version: "2",
    chainId,
    verifyingContract: usdcAddress,
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

  const from = await signer.getAddress();

  const message = {
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await (signer as ethers.Wallet).signTypedData(domain, types, message);

  return { signature, nonce, validAfter, validBefore };
}

/**
 * Generate a unique nonce for EIP-3009.
 */
export function generateNonce(): string {
  return ethers.hexlify(ethers.randomBytes(32));
}

/**
 * Encode payment header for x402 HTTP header (X-PAYMENT).
 */
export function encodePaymentHeader(params: {
  from: string;
  amount: string;
  nonce: string;
  validAfter: number;
  validBefore: number;
  stealthAddress: string;
  ephemeralPubKey: string;
  viewTag: number;
  signature: string;
}): string {
  return Buffer.from(JSON.stringify(params)).toString("base64");
}

/**
 * Decode payment header from x402 HTTP header (X-PAYMENT).
 */
export function decodePaymentHeader(header: string): {
  from: string;
  amount: string;
  nonce: string;
  validAfter: number;
  validBefore: number;
  stealthAddress: string;
  ephemeralPubKey: string;
  viewTag: number;
  signature: string;
} {
  return JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
}
