// @stealthpay402/sdk — Main Entry Point
// x402 Privacy Payment Gateway SDK for AI Agents on Polygon

// Server-side exports
export { stealthPay402 } from "./server/middleware";
export type { StealthPay402Options } from "./server/middleware";
export { PaymentVerifier } from "./server/verifier";
export { StealthScanner } from "./server/scanner";

// Client-side exports
export { payForAccess } from "./client/agent";
export type { AgentPaymentOptions } from "./client/agent";
export { createAgentWallet, loadAgentWallet, getUsdcBalance } from "./client/wallet";

// Stealth address utilities
export {
  generateStealthKeys,
  generateStealthAddress,
  checkStealthAddress,
  deriveStealthSpendingKey,
  parseMetaAddress,
  computeViewTag,
} from "./utils/crypto";

// EIP-3009 utilities
export {
  signTransferAuthorization,
  generateNonce,
  encodePaymentHeader,
  decodePaymentHeader,
} from "./utils/eip3009";

// Contract addresses and types
export { DEPLOYED_ADDRESSES, getAddresses } from "./contracts/addresses";
export type {
  PaymentParams,
  PaymentRequirement,
  StealthPayment,
  AgentInfo,
  StealthKeys,
  GeneratedStealthAddress,
} from "./contracts/types";
