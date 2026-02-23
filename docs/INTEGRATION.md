# StealthPay402 Integration Guide

## For API Providers (Server-Side)

### 1. Install

```bash
npm install @stealthpay402/sdk ethers
```

### 2. Add Middleware

```typescript
import express from 'express';
import { stealthPay402 } from '@stealthpay402/sdk/server';

const app = express();

app.get('/api/premium-data', stealthPay402({
  price: '0.01',           // 0.01 USDC per request
  routerAddress: '0x...',  // StealthPaymentRouter on Polygon
  chain: 137,              // Polygon Mainnet
  rpcUrl: 'https://polygon-rpc.com',
}), (req, res) => {
  res.json({ data: 'premium content' });
});
```

### 3. Register Stealth Meta-Address

```typescript
import { generateStealthKeys } from '@stealthpay402/sdk';

const keys = generateStealthKeys();
// Register keys.metaAddress on StealthMetaRegistry contract
// Store keys.viewingPrivateKey and keys.spendingPrivateKey securely
```

### 4. Scan for Payments

```typescript
import { StealthScanner } from '@stealthpay402/sdk';

const scanner = new StealthScanner(rpcUrl, announcerAddress);
const payments = await scanner.scanPayments(
  viewingPrivateKey,
  spendingPublicKey,
  fromBlock
);
```

## For AI Agents (Client-Side)

### 1. Create Agent Wallet

```typescript
import { createAgentWallet } from '@stealthpay402/sdk';

const { wallet, stealthKeys } = createAgentWallet();
// Fund wallet with USDC on Polygon
```

### 2. Make Paid API Calls

```typescript
import { payForAccess } from '@stealthpay402/sdk';

const result = await payForAccess('https://api.example.com/data', {
  wallet,
  privatePayment: true,
  maxPayment: '1.00',
});
```

### 3. Register as Agent (Optional)

```typescript
// Call AgentRegistry.registerAgent(metadataHash)
// This enables reputation tracking and higher spending limits
```
