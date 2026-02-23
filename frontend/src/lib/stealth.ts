import * as secp from "@noble/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";
import { ethers } from "ethers";

/**
 * ERC-5564 stealth address generation using secp256k1 ECDH.
 *
 * Flow:
 * 1. Sender generates ephemeral keypair (ephPriv, ephPub)
 * 2. ECDH: S = ephPriv * viewingPubKey
 * 3. Hash: h = keccak256(S)
 * 4. View tag: first byte of h
 * 5. Stealth public key: P_stealth = spendingPubKey + h * G
 * 6. Stealth address: addr(P_stealth)
 */

function strip0x(hex: string): string {
  return hex.startsWith("0x") ? hex.slice(2) : hex;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = strip0x(hex);
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

/**
 * Generate a stealth address from a recipient's meta-address.
 * Uses the exact same ECDH + EC point addition as the SDK.
 */
export function generateStealthAddress(metaAddress: string): {
  stealthAddress: string;
  ephemeralPublicKey: string;
  viewTag: number;
} {
  const metaBytes = hexToBytes(metaAddress);
  if (metaBytes.length !== 66) {
    throw new Error(`Invalid meta-address length: ${metaBytes.length} (expected 66)`);
  }

  const spendingPubKey = metaBytes.slice(0, 33);
  const viewingPubKey = metaBytes.slice(33, 66);

  // Generate ephemeral keypair
  const ephPriv = secp.utils.randomPrivateKey();
  const ephPub = secp.getPublicKey(ephPriv, true); // compressed 33 bytes

  // ECDH: shared secret point S = ephPriv * viewingPubKey
  const sharedSecretPoint = secp.getSharedSecret(ephPriv, viewingPubKey);

  // Hash the shared secret
  const sharedSecretHash = keccak_256(sharedSecretPoint);

  // View tag = first byte of hash
  const viewTag = sharedSecretHash[0];

  // h * G (generator point multiplication)
  const hScalar = bytesToBigInt(sharedSecretHash) % secp.CURVE.n;
  const hTimesG = secp.ProjectivePoint.BASE.multiply(hScalar);

  // Stealth public key = spendingPubKey + h * G (EC point addition)
  const spendingPoint = secp.ProjectivePoint.fromHex(spendingPubKey);
  const stealthPoint = spendingPoint.add(hTimesG);

  // Uncompressed public key (65 bytes: 04 || x || y)
  const stealthPubUncompressed = stealthPoint.toRawBytes(false);

  // Ethereum address from uncompressed public key
  const stealthAddress = ethers.computeAddress(bytesToHex(stealthPubUncompressed));

  return {
    stealthAddress,
    ephemeralPublicKey: bytesToHex(ephPub),
    viewTag,
  };
}

/**
 * Demo receiver stealth meta-address.
 * Deterministically derived from known seeds so the demo is reproducible.
 * In production, this would come from StealthMetaRegistry on-chain.
 */
function computeDemoMetaAddress(): string {
  const spendSeed = keccak_256(new TextEncoder().encode("stealthpay402-demo-spending-v1"));
  const viewSeed = keccak_256(new TextEncoder().encode("stealthpay402-demo-viewing-v1"));

  const spendPub = secp.getPublicKey(spendSeed, true);
  const viewPub = secp.getPublicKey(viewSeed, true);

  const meta = new Uint8Array(66);
  meta.set(spendPub, 0);
  meta.set(viewPub, 33);

  return bytesToHex(meta);
}

export const DEMO_META_ADDRESS = computeDemoMetaAddress();
