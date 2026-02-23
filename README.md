# StealthPay402

**x402 Privacy Payment Gateway for AI Agents on Polygon**

StealthPay402 combines the x402 pay-per-request protocol with ERC-5564 stealth addresses to enable private, gasless payments for AI agents on Polygon. Agents pay for API access directly via HTTP — no accounts, no API keys, no linked transactions.

## Architecture

```
AI Agent                    API Server
   |                           |
   |--- GET /api/data -------->|
   |                           |
   |<-- 402 Payment Required --|  (price, token, receiver meta-address)
   |                           |
   |  [Generate stealth addr]  |
   |  [Sign EIP-3009 auth]     |
   |                           |
   |--- GET /api/data -------->|  (X-PAYMENT header)
   |                           |
   |    ┌─────────────────────────────────────┐
   |    │  Polygon (StealthPaymentRouter)     │
   |    │  1. Verify EIP-3009 signature       │
   |    │  2. USDC.transferWithAuthorization() │
   |    │  3. Deduct 0.1% fee → FeeVault      │
   |    │  4. Route USDC → stealth address     │
   |    │  5. Emit ERC-5564 Announcement       │
   |    └─────────────────────────────────────┘
   |                           |
   |<-- 200 OK + data ---------|
```

## Smart Contracts

| Contract | Purpose | Standard |
|----------|---------|----------|
| `StealthPaymentRouter` | Core payment orchestrator | x402 + EIP-3009 |
| `StealthAnnouncer` | Stealth payment events | ERC-5564 |
| `StealthMetaRegistry` | Recipient key registry | ERC-6538 |
| `FeeVault` | Fee collection vault | ERC-4626 |
| `AgentRegistry` | Agent identity + reputation | Custom |
| `ComplianceGate` | ZK-KYC verification | Polygon ID |
| `CrossChainRouter` | Cross-chain payments | AggLayer |

## Quick Start

```bash
# Clone
git clone https://github.com/stealthpay402/stealthpay402
cd stealthpay402

# Install
npm install

# Compile contracts
npm run compile

# Run tests (99 tests)
npm test

# Deploy to local Hardhat
npm run deploy:local

# Deploy to Polygon Amoy testnet
npm run deploy:amoy
```

## Contract Addresses

### Polygon Amoy Testnet (80002)
| Contract | Address | Verified |
|----------|---------|----------|
| StealthPaymentRouter | [`0x505285860b5ECdAb4aaf1EB822e1c1FFb3836729`](https://amoy.polygonscan.com/address/0x505285860b5ECdAb4aaf1EB822e1c1FFb3836729) | Yes |
| StealthAnnouncer | [`0x2314F19Bc7Fc8e3cAFEC8D8bC157402b0DF8025C`](https://amoy.polygonscan.com/address/0x2314F19Bc7Fc8e3cAFEC8D8bC157402b0DF8025C) | Yes |
| StealthMetaRegistry | [`0x9d0cDD13239b8ce12A8F07e62315aBd96605127a`](https://amoy.polygonscan.com/address/0x9d0cDD13239b8ce12A8F07e62315aBd96605127a) | Yes |
| FeeVault | [`0x5e41d2A5F67bCaaf187FFF5E727790e60B93AEe4`](https://amoy.polygonscan.com/address/0x5e41d2A5F67bCaaf187FFF5E727790e60B93AEe4) | Yes |
| AgentRegistry | [`0x7F657448444456e8E878f8575822ef7268d6b5e3`](https://amoy.polygonscan.com/address/0x7F657448444456e8E878f8575822ef7268d6b5e3) | Yes |
| ComplianceGate | [`0x0C3F48c3e863f13b9F7e1dEF0F77A94a073b2D0F`](https://amoy.polygonscan.com/address/0x0C3F48c3e863f13b9F7e1dEF0F77A94a073b2D0F) | Yes |
| CrossChainRouter | [`0x8ACB1d549915eE2d5eAcb844d971C58767590833`](https://amoy.polygonscan.com/address/0x8ACB1d549915eE2d5eAcb844d971C58767590833) | Yes |
| MockUSDC | [`0x6a06aeD671156A3C133AAe0EEc7f93f679a3eC4c`](https://amoy.polygonscan.com/address/0x6a06aeD671156A3C133AAe0EEc7f93f679a3eC4c) | Yes |

**E2E Payment Verified:** [`0x6cc0d3e...b64024`](https://amoy.polygonscan.com/tx/0x6cc0d3e23715ac651993ee05f107bec16f8ae39e42ea4d3d4f877d0548b64024)

## SDK Usage

### Server (Protect your API)

```typescript
import express from 'express';
import { stealthPay402 } from '@stealthpay402/sdk/server';

const app = express();

app.get('/api/data', stealthPay402({
  price: '0.01',
  chain: 137,
  routerAddress: '0x...',
}), (req, res) => {
  res.json({ data: 'premium content' });
});
```

### Client (AI Agent)

```typescript
import { payForAccess } from '@stealthpay402/sdk';

const result = await payForAccess('https://api.example.com/data', {
  wallet: agentWallet,
  privatePayment: true,
});
console.log(result.data);
```

## Tech Stack

- **Contracts:** Solidity 0.8.20, OpenZeppelin v5, Hardhat
- **Standards:** ERC-5564, ERC-6538, ERC-4626, EIP-3009, EIP-712
- **Frontend:** React 18, Vite, Tailwind CSS, Recharts, Zustand
- **SDK:** TypeScript, ethers.js v6
- **Networks:** Polygon PoS (137), Amoy (80002), zkEVM Cardona (2442)
- **Polygon Tech:** AggLayer, x402, Polygon ID

## Security

- `ReentrancyGuard` on all payment functions
- Checks-effects-interactions pattern
- `SafeERC20` for all token transfers
- Nonce-based replay prevention
- `Pausable` emergency stop
- 1% max fee cap
- Daily spending limits per agent
- `Ownable` admin controls

## Project Structure

```
stealthpay402/
├── contracts/           # 7 Solidity contracts + 3 mocks
│   ├── core/           # Router, Announcer, MetaRegistry
│   ├── finance/        # ERC-4626 FeeVault
│   ├── identity/       # AgentRegistry, ComplianceGate
│   ├── cross-chain/    # AggLayer CrossChainRouter
│   ├── interfaces/     # Contract interfaces
│   ├── libraries/      # StealthLib, X402Lib
│   └── mocks/          # MockUSDC, MockPolygonID, MockBridge
├── test/               # 99 Hardhat tests
│   ├── integration/    # End-to-end flow tests
│   └── helpers/        # Test fixtures
├── scripts/            # Deploy + verify scripts
├── sdk/                # @stealthpay402/sdk TypeScript package
├── frontend/           # React + Vite dashboard
├── demo-server/        # Express x402 demo endpoints
└── docs/               # Integration docs
```

## Why Polygon

- **Payments focus:** Polygon's #1 priority in 2026
- **AggLayer:** Native cross-chain payment routing
- **x402:** Pay-per-request standard backed by Coinbase
- **Polygon ID:** ZK-based compliance without revealing identity
- **Gas costs:** ~$0.0001 per transaction
- **EIP-3009:** USDC natively supports gasless transfers on Polygon

## Business Model

- 0.1% platform fee per transaction (configurable, max 1%)
- Agent registration fees
- Cross-chain premium fees
- Enterprise compliance licensing

## License

MIT
