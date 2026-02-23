import { ethers } from "ethers";
import * as secp from "@noble/secp256k1";
import { keccak_256 } from "@noble/hashes/sha3";

/**
 * Stealth address cryptography utilities using secp256k1.
 *
 * ERC-5564 Stealth Address Flow:
 * 1. Recipient publishes meta-address: (spendingPubKey, viewingPubKey)
 * 2. Sender generates ephemeral keypair: (ephPriv, ephPub)
 * 3. Sender computes shared secret: S = ephPriv * viewingPubKey (ECDH)
 * 4. Sender derives stealth address: addr(spendingPubKey + hash(S) * G)
 * 5. Sender announces ephPub + viewTag
 * 6. Recipient scans: S' = viewingPrivKey * ephPub, checks viewTag, derives key
 */

/** Strip 0x prefix and return raw hex string */
function strip0x(hex: string): string {
  return hex.startsWith("0x") ? hex.slice(2) : hex;
}

/** Convert hex string to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const clean = strip0x(hex);
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Convert Uint8Array to 0x-prefixed hex string */
function bytesToHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a new stealth key pair (spending + viewing keys).
 */
export function generateStealthKeys(): {
  spendingPrivateKey: string;
  viewingPrivateKey: string;
  spendingPublicKey: string;
  viewingPublicKey: string;
  metaAddress: string;
} {
  const spendingPriv = secp.utils.randomPrivateKey();
  const viewingPriv = secp.utils.randomPrivateKey();

  const spendingPub = secp.getPublicKey(spendingPriv, true); // compressed 33 bytes
  const viewingPub = secp.getPublicKey(viewingPriv, true);   // compressed 33 bytes

  // Meta-address = spending pubkey || viewing pubkey (66 bytes total)
  const metaBytes = new Uint8Array(66);
  metaBytes.set(spendingPub, 0);
  metaBytes.set(viewingPub, 33);

  return {
    spendingPrivateKey: bytesToHex(spendingPriv),
    viewingPrivateKey: bytesToHex(viewingPriv),
    spendingPublicKey: bytesToHex(spendingPub),
    viewingPublicKey: bytesToHex(viewingPub),
    metaAddress: bytesToHex(metaBytes),
  };
}

/**
 * Parse a stealth meta-address into spending and viewing public keys.
 */
export function parseMetaAddress(metaAddress: string): {
  spendingPubKey: string;
  viewingPubKey: string;
} {
  const bytes = hexToBytes(metaAddress);
  if (bytes.length !== 66) {
    throw new Error(`Invalid meta-address length: ${bytes.length} (expected 66)`);
  }

  return {
    spendingPubKey: bytesToHex(bytes.slice(0, 33)),
    viewingPubKey: bytesToHex(bytes.slice(33, 66)),
  };
}

/**
 * Generate a stealth address from a recipient's meta-address.
 *
 * Proper ERC-5564 derivation using EC point addition:
 * 1. Generate ephemeral keypair (ephPriv, ephPub)
 * 2. ECDH: S = ephPriv * viewingPubKey
 * 3. Hash: h = keccak256(S)
 * 4. View tag: first byte of h
 * 5. Stealth public key: P_stealth = spendingPubKey + h * G
 * 6. Stealth address: addr(P_stealth)
 */
export function generateStealthAddress(metaAddress: string): {
  stealthAddress: string;
  ephemeralPublicKey: string;
  viewTag: number;
  ephemeralPrivateKey: string;
} {
  const { spendingPubKey, viewingPubKey } = parseMetaAddress(metaAddress);

  // Generate ephemeral keypair
  const ephPriv = secp.utils.randomPrivateKey();
  const ephPub = secp.getPublicKey(ephPriv, true); // compressed

  // ECDH: shared secret point S = ephPriv * viewingPubKey
  const sharedSecretPoint = secp.getSharedSecret(ephPriv, hexToBytes(viewingPubKey));

  // Hash the shared secret (use the full uncompressed point)
  const sharedSecretHash = keccak_256(sharedSecretPoint);

  // View tag = first byte of hash
  const viewTag = sharedSecretHash[0];

  // Convert hash to scalar for EC point multiplication
  // h * G (generator point multiplication)
  const hTimesG = secp.ProjectivePoint.BASE.multiply(
    bytesToBigInt(sharedSecretHash) % secp.CURVE.n
  );

  // Stealth public key = spendingPubKey + h * G (EC point addition)
  const spendingPoint = secp.ProjectivePoint.fromHex(strip0x(spendingPubKey));
  const stealthPoint = spendingPoint.add(hTimesG);

  // Get uncompressed public key (65 bytes: 04 || x || y)
  const stealthPubUncompressed = stealthPoint.toRawBytes(false);

  // Ethereum address = last 20 bytes of keccak256(pubkey without 04 prefix)
  const stealthAddress = ethers.computeAddress(bytesToHex(stealthPubUncompressed));

  return {
    stealthAddress,
    ephemeralPublicKey: bytesToHex(ephPub),
    viewTag,
    ephemeralPrivateKey: bytesToHex(ephPriv),
  };
}

/**
 * Check if a stealth payment is addressed to you (recipient-side).
 *
 * 1. ECDH: S = viewingPrivKey * ephPubKey
 * 2. Hash: h = keccak256(S)
 * 3. View tag check (quick filter)
 * 4. Stealth public key: P_stealth = spendingPubKey + h * G
 * 5. Compare addr(P_stealth) with actual stealth address
 */
export function checkStealthAddress(
  ephemeralPubKey: string,
  viewingPrivateKey: string,
  stealthAddress: string,
  spendingPubKey: string
): boolean {
  try {
    // ECDH: S = viewingPrivKey * ephPubKey
    const sharedSecretPoint = secp.getSharedSecret(
      hexToBytes(viewingPrivateKey),
      hexToBytes(ephemeralPubKey)
    );

    const sharedSecretHash = keccak_256(sharedSecretPoint);

    // h * G
    const hScalar = bytesToBigInt(sharedSecretHash) % secp.CURVE.n;
    const hTimesG = secp.ProjectivePoint.BASE.multiply(hScalar);

    // Stealth public key = spendingPubKey + h * G
    const spendingPoint = secp.ProjectivePoint.fromHex(strip0x(spendingPubKey));
    const stealthPoint = spendingPoint.add(hTimesG);

    const stealthPubUncompressed = stealthPoint.toRawBytes(false);
    const expectedAddress = ethers.computeAddress(bytesToHex(stealthPubUncompressed));

    return expectedAddress.toLowerCase() === stealthAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Derive the stealth spending private key (to claim funds).
 *
 * stealthPrivKey = spendingPrivKey + h (mod n)
 * where h = keccak256(viewingPrivKey * ephPubKey)
 */
export function deriveStealthSpendingKey(
  spendingPrivateKey: string,
  viewingPrivateKey: string,
  ephemeralPubKey: string
): string {
  const sharedSecretPoint = secp.getSharedSecret(
    hexToBytes(viewingPrivateKey),
    hexToBytes(ephemeralPubKey)
  );

  const sharedSecretHash = keccak_256(sharedSecretPoint);
  const h = bytesToBigInt(sharedSecretHash) % secp.CURVE.n;
  const spendPriv = bytesToBigInt(hexToBytes(spendingPrivateKey));

  // stealth priv = (spendingPriv + h) mod n
  const stealthPriv = (spendPriv + h) % secp.CURVE.n;

  return "0x" + stealthPriv.toString(16).padStart(64, "0");
}

/**
 * Compute the view tag from a shared secret for quick filtering.
 */
export function computeViewTag(sharedSecretHash: Uint8Array | string): number {
  if (typeof sharedSecretHash === "string") {
    return parseInt(sharedSecretHash.slice(2, 4), 16);
  }
  return sharedSecretHash[0];
}

/** Convert Uint8Array to BigInt (big-endian) */
function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}
