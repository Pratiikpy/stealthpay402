export interface PaymentParams {
  from: string;
  amount: bigint;
  nonce: string;
  validAfter: number;
  validBefore: number;
  stealthAddress: string;
  ephemeralPubKey: string;
  viewTag: number;
  signature: string;
}

export interface PaymentRequirement {
  amount: string;
  token: string;
  chain: number;
  receiver: string;
  receiverMetaAddress?: string;
  facilitator: string;
  description?: string;
}

export interface StealthPayment {
  stealthAddress: string;
  ephemeralPubKey: string;
  viewTag: number;
  amount: bigint;
  blockNumber: number;
  transactionHash: string;
  caller: string;
}

export interface AgentInfo {
  owner: string;
  metadataHash: string;
  dailySpendLimit: bigint;
  spentToday: bigint;
  lastResetTimestamp: bigint;
  reputationScore: bigint;
  totalTransactions: bigint;
  totalVolume: bigint;
  isActive: boolean;
  registeredAt: bigint;
}

export interface StealthKeys {
  spendingPrivateKey: string;
  viewingPrivateKey: string;
  spendingPublicKey: string;
  viewingPublicKey: string;
  metaAddress: string;
}

export interface GeneratedStealthAddress {
  stealthAddress: string;
  ephemeralPublicKey: string;
  viewTag: number;
}
