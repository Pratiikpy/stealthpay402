# StealthPay402

x402 payment gateway with ERC-5564 stealth addresses on Polygon. AI agents pay for API access per-request via HTTP 402 — payments are private, gasless for the payer, and settled in USDC on-chain.

**Live Demo:** https://stealthpay402.vercel.app
**Network:** Polygon Mainnet (137) — all contracts verified on Polygonscan

---

## What This Does

An AI agent calls an API. The server returns HTTP 402 with a price. The agent generates a one-time stealth address, signs a USDC authorization off-chain (EIP-3009), and resubmits. The server verifies payment on-chain and serves the data. Nobody watching the chain can link the payment to the agent's real address.

```
                         ┌──────────────────────────────────────────┐
                         │              Polygon Mainnet             │
                         │                                          │
Agent ── GET /api ──► Server                                        │
      ◄── 402 ────── Server                                        │
                         │                                          │
Agent:                   │                                          │
 • ephKey = random()     │                                          │
 • S = ECDH(ephKey,      │                                          │
     viewingPubKey)      │                                          │
 • stealth = spend +     │                                          │
     hash(S) * G         │                                          │
 • sig = EIP-3009 sign   │                                          │
                         │                                          │
Agent ── GET /api ──► Server ──► StealthPaymentRouter               │
     (X-PAYMENT hdr)     │       ├─ USDC.transferWithAuthorization  │
                         │       ├─ 0.1% fee ──► FeeVault (ERC-4626)│
                         │       ├─ remainder ──► stealth address   │
                         │       └─ StealthAnnouncer.announce()     │
      ◄── 200 + data     │           (ERC-5564 event)              │
                         └──────────────────────────────────────────┘
```

Only the recipient, using their viewing key, can scan `Announcement` events and identify which payments are theirs.

---

## Contract Addresses — Polygon Mainnet (137)

| Contract | Address | Polygonscan |
|----------|---------|-------------|
| StealthPaymentRouter | `0x78308d47c2f534C4D51B35B1e1E95dFb689b9a86` | [verified](https://polygonscan.com/address/0x78308d47c2f534C4D51B35B1e1E95dFb689b9a86#code) |
| StealthAnnouncer | `0x1392C68fDD7EFF17b16F16350db834FA8FFFD40f` | [verified](https://polygonscan.com/address/0x1392C68fDD7EFF17b16F16350db834FA8FFFD40f#code) |
| StealthMetaRegistry | `0x0709857a1556C194637D7b6Aa9bD230744985c9D` | [verified](https://polygonscan.com/address/0x0709857a1556C194637D7b6Aa9bD230744985c9D#code) |
| FeeVault | `0x0D0FfD08A799182CEBaae665cC84d7ae0260194b` | [verified](https://polygonscan.com/address/0x0D0FfD08A799182CEBaae665cC84d7ae0260194b#code) |
| AgentRegistry | `0xAD60dCBb80Bc71EF9Ee1463a5842aC1354A3d6b5` | [verified](https://polygonscan.com/address/0xAD60dCBb80Bc71EF9Ee1463a5842aC1354A3d6b5#code) |
| ComplianceGate | `0x49dc97c79DD786008f5b8059366C4bbB91357D5F` | [verified](https://polygonscan.com/address/0x49dc97c79DD786008f5b8059366C4bbB91357D5F#code) |
| CrossChainRouter | `0x18Aade5d6368eA5171217D91634a92c2EBDDF5E9` | [verified](https://polygonscan.com/address/0x18Aade5d6368eA5171217D91634a92c2EBDDF5E9#code) |

Uses native USDC on Polygon: [`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`](https://polygonscan.com/address/0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359)

**Mainnet E2E payment TX:** [`0xdf5edc40...a0caeb`](https://polygonscan.com/tx/0xdf5edc40df3728f795d2d78c1fa9c4bd53b971bb24d1027eb9a4590617a0caeb)

### Amoy Testnet (80002)

Also deployed and verified on Amoy — [see deployment file](./deployments/polygonAmoy-80002.json)

---

## How Stealth Addresses Work

```
Recipient publishes:   metaAddress = spendPub || viewPub   (66 bytes, on-chain via ERC-6538)

Sender:
  1. ephPriv = random()
  2. S = ECDH(ephPriv, viewPub)           ← shared secret
  3. h = keccak256(S)
  4. stealthPub = spendPub + h * G        ← EC point addition
  5. stealthAddr = ethAddr(stealthPub)     ← one-time address
  6. emit Announcement(ephPub, viewTag)

Recipient scanning:
  1. S' = ECDH(viewPriv, ephPub)          ← same shared secret
  2. h' = keccak256(S')
  3. Check: viewTag matches?              ← eliminates 255/256 false positives
  4. stealthPriv = spendPriv + h'          ← can now spend from stealth address
```

No one else can compute S, so no one else can link the stealth address to the recipient.

---

## SDK

### Protect your API (server-side)

```typescript
import express from 'express';
import { stealthPay402 } from '@stealthpay402/sdk/server';

const app = express();

app.get('/api/data', stealthPay402({
  price: '0.01',
  chain: 137,
  routerAddress: '0x78308d47c2f534C4D51B35B1e1E95dFb689b9a86',
}), (req, res) => {
  res.json({ temperature: 22.5 });
});
```

### Pay for access (agent-side)

```typescript
import { payForAccess } from '@stealthpay402/sdk';

const result = await payForAccess('https://api.example.com/data', {
  wallet: agentWallet,
  privatePayment: true,
});
// result.data = { temperature: 22.5 }
```

---

## Run Locally

```bash
git clone https://github.com/Pratiikpy/stealthpay402
cd stealthpay402

npm install          # root + contracts
npm run compile      # compile Solidity
npm test             # 99 tests

cd frontend && npm install && npm run dev   # localhost:5173
cd demo-server && npm install && npm start  # localhost:3001
```

### Deploy

```bash
cp .env.example .env   # add DEPLOYER_PRIVATE_KEY, POLYGONSCAN_API_KEY

npx hardhat run scripts/deploy-all.js --network polygonAmoy      # testnet
npx hardhat run scripts/deploy-all.js --network polygonMainnet   # mainnet
npx hardhat run scripts/verify-contracts.js --network polygonMainnet
```

The deploy script auto-updates SDK and frontend address files.

---

## Contracts

| Contract | What it does | Standards |
|----------|-------------|-----------|
| **StealthPaymentRouter** | Receives EIP-3009 signed USDC authorizations, takes fee, routes payment to stealth address, emits announcement | x402, EIP-3009, EIP-712 |
| **StealthAnnouncer** | Emits `Announcement` events that recipients scan with their viewing key | ERC-5564 |
| **StealthMetaRegistry** | Stores recipient meta-addresses (spendPub + viewPub) so senders can look them up | ERC-6538 |
| **FeeVault** | Collects platform fees (0.1%, max 1%), ERC-4626 vault with withdraw-to-treasury | ERC-4626 |
| **AgentRegistry** | On-chain agent identity — registration, daily spend limits, reputation scoring, tx history | — |
| **ComplianceGate** | Optional ZK-KYC gate using Polygon ID credential verification | Polygon ID |
| **CrossChainRouter** | Routes payments across Polygon chains (PoS, zkEVM) via AggLayer bridge | AggLayer |

Security: ReentrancyGuard, SafeERC20, Pausable, checks-effects-interactions, nonce replay prevention, 1% fee cap, daily agent spend limits.

---

## Project Structure

```
stealthpay402/
├── contracts/
│   ├── core/            StealthPaymentRouter, StealthAnnouncer, StealthMetaRegistry
│   ├── finance/         FeeVault (ERC-4626)
│   ├── identity/        AgentRegistry, ComplianceGate
│   ├── cross-chain/     CrossChainRouter (AggLayer)
│   ├── interfaces/      IStealthAnnouncer, IFeeVault, etc.
│   ├── libraries/       StealthLib, X402Lib
│   └── mocks/           MockUSDC, MockPolygonID, MockBridge
├── test/                99 tests — unit + integration + e2e
├── scripts/             deploy-all.js, verify-contracts.js
├── sdk/                 TypeScript SDK — server middleware + client
├── frontend/            React + Vite + Tailwind — dashboard, demo, scanner
├── demo-server/         Express server with x402 middleware
└── deployments/         JSON files with deployed addresses per network
```

---

## Why Polygon

- USDC on Polygon natively supports EIP-3009 (`transferWithAuthorization`) — gasless transfers without approve+transferFrom
- ~$0.001 per transaction — viable for $0.01 micropayments
- AggLayer enables cross-chain stealth payments across Polygon CDK chains
- Polygon ID provides ZK-based compliance (prove you're KYC'd without revealing identity)
- x402 protocol aligns with Polygon's payments focus

## Revenue

0.1% fee per payment, collected in the ERC-4626 FeeVault. Configurable by owner, hard-capped at 1%.

## License

MIT
