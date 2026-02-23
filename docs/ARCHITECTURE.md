# StealthPay402 Architecture

## System Overview

StealthPay402 is a payment gateway that combines:
- **x402 Protocol** — HTTP-native pay-per-request (HTTP 402 Payment Required)
- **ERC-5564 Stealth Addresses** — One-time recipient addresses for privacy
- **EIP-3009** — Gasless USDC transfers via signed authorizations

## Contract Dependency Graph

```
StealthPaymentRouter (CORE)
├── StealthAnnouncer (ERC-5564 events)
├── FeeVault (ERC-4626 fee collection)
├── AgentRegistry (identity + rate limits)
├── ComplianceGate (ZK-KYC via Polygon ID)
└── StealthMetaRegistry (ERC-6538 key registry)

CrossChainRouter (AggLayer bridge)
└── StealthPaymentRouter (local routing)
```

## Payment Flow

1. **AI Agent** calls `GET /api/data`
2. **Server** returns `402 Payment Required` with payment instructions
3. **Agent** generates stealth address from receiver's meta-address (ECDH on secp256k1)
4. **Agent** signs EIP-3009 `transferWithAuthorization` for USDC
5. **Agent** retries with `X-PAYMENT` header containing signed authorization
6. **StealthPaymentRouter** verifies and executes:
   - Calls `USDC.transferWithAuthorization()` (gasless for agent)
   - Deducts 0.1% fee → FeeVault
   - Routes remaining USDC → stealth address
   - Emits ERC-5564 `Announcement` event
7. **Server** verifies payment on-chain, serves data
8. **Receiver** later scans `Announcement` events with viewing key, claims funds

## Stealth Address Cryptography

Uses secp256k1 elliptic curve (ERC-5564 scheme ID = 1):

- **Meta-address:** `spendingPubKey || viewingPubKey` (66 bytes compressed)
- **Generation:** Sender creates ephemeral keypair, computes ECDH shared secret with viewing key
- **View tag:** First byte of `keccak256(sharedSecret)` for fast scanning (~1/256 false positive rate)
- **Stealth address:** Derived from spending key + hashed shared secret

## Security Model

| Threat | Mitigation |
|--------|-----------|
| Payment replay | Nonce tracking (`processed` mapping) |
| Front-running | EIP-3009 signed authorization |
| Privacy linkability | One-time stealth addresses + view tags |
| Fee manipulation | MAX_FEE cap (1%), `onlyOwner` |
| Agent griefing | Daily spending limits + reputation |
| Reentrancy | `ReentrancyGuard` on all payment functions |
| Emergency | `Pausable` + `emergencyWithdraw` |
