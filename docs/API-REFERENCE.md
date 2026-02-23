# StealthPay402 SDK API Reference

## Server

### `stealthPay402(options)`

Express middleware that gates API endpoints behind x402 stealth payments.

**Options:**
- `price: string` — Required payment amount in USDC (e.g., "0.01")
- `token?: string` — Token symbol (default: "USDC")
- `chain?: number` — Chain ID (default: 137)
- `routerAddress: string` — StealthPaymentRouter contract address
- `rpcUrl?: string` — RPC URL for on-chain verification
- `receiverMetaAddress?: string` — Stealth meta-address for private payments

### `PaymentVerifier`

On-chain payment verification.

```typescript
const verifier = new PaymentVerifier(rpcUrl, routerAddress);
await verifier.isProcessed(nonce);        // Check if nonce used
await verifier.getPaymentFromTx(txHash);  // Get payment details
await verifier.getPlatformFee();          // Get current fee (bps)
```

### `StealthScanner`

Scan for stealth payments addressed to you.

```typescript
const scanner = new StealthScanner(rpcUrl, announcerAddress);
const payments = await scanner.scanPayments(viewingKey, spendingPubKey, fromBlock);
```

## Client

### `payForAccess(url, options)`

Make a paid API request with automatic 402 handling.

**Options:**
- `wallet: ethers.Wallet` — Agent wallet with USDC
- `privatePayment?: boolean` — Use stealth addresses (default: true)
- `maxPayment?: string` — Safety limit in USDC (default: "10.0")
- `chainId?: number` — Chain ID override
- `usdcAddress?: string` — USDC contract address
- `routerAddress?: string` — Router address

**Returns:** `{ status, data, paymentInfo }`

### `createAgentWallet(provider?)`

Create a new agent wallet with stealth keys.

### `loadAgentWallet(privateKey, rpcUrl?)`

Load an existing wallet from a private key.

## Utilities

### `generateStealthKeys()`

Generate a new spending + viewing key pair and meta-address.

### `generateStealthAddress(metaAddress)`

Generate a one-time stealth address from a recipient's meta-address.

### `checkStealthAddress(ephPubKey, viewingKey, stealthAddr, spendingPubKey)`

Check if a stealth payment is addressed to you.

### `signTransferAuthorization(params)`

Sign an EIP-3009 transferWithAuthorization for USDC.

### `generateNonce()`

Generate a random 32-byte nonce.

### `encodePaymentHeader(params)` / `decodePaymentHeader(header)`

Encode/decode the X-PAYMENT HTTP header (base64 JSON).
