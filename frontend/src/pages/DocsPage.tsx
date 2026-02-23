import { Code, Server, Bot, Terminal } from "lucide-react";
import { CONTRACT_ADDRESSES } from "../lib/contracts";

const CONTRACT_NAMES = [
  "StealthPaymentRouter",
  "StealthAnnouncer",
  "StealthMetaRegistry",
  "FeeVault",
  "AgentRegistry",
  "ComplianceGate",
  "CrossChainRouter",
];

function formatAddress(addr: string | undefined) {
  if (!addr) return <span className="text-gray-600">Not deployed</span>;
  return (
    <a
      href={`https://amoy.polygonscan.com/address/${addr}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary-400 hover:underline"
    >
      {addr.slice(0, 6)}...{addr.slice(-4)}
    </a>
  );
}

function formatAddressMainnet(addr: string | undefined) {
  if (!addr) return <span className="text-gray-600">Not deployed</span>;
  return (
    <a
      href={`https://polygonscan.com/address/${addr}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary-400 hover:underline"
    >
      {addr.slice(0, 6)}...{addr.slice(-4)}
    </a>
  );
}

export default function DocsPage() {
  const amoyAddresses = CONTRACT_ADDRESSES[80002] || {};
  const mainnetAddresses = CONTRACT_ADDRESSES[137] || {};

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Integration Guide</h1>
      <p className="mb-8 text-gray-400">
        Add x402 privacy payments to your API in minutes. Install the SDK, add
        middleware, and start accepting stealth payments.
      </p>

      {/* Install */}
      <section className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="h-5 w-5 text-primary-400" />
          <h2 className="text-xl font-semibold">1. Install SDK</h2>
        </div>
        <pre className="rounded-lg bg-gray-800 p-4 text-sm text-green-400 overflow-x-auto">
          npm install @stealthpay402/sdk ethers
        </pre>
      </section>

      {/* Server Setup */}
      <section className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Server className="h-5 w-5 text-primary-400" />
          <h2 className="text-xl font-semibold">2. Protect Your API (Server)</h2>
        </div>
        <pre className="rounded-lg bg-gray-800 p-4 text-sm text-gray-300 overflow-x-auto">
{`import express from 'express';
import { stealthPay402 } from '@stealthpay402/sdk/server';

const app = express();

// Protect endpoint with x402 payment wall
app.get('/api/weather', stealthPay402({
  price: '0.01',           // 0.01 USDC per request
  token: 'USDC',
  chain: 137,              // Polygon Mainnet
  routerAddress: '0x...',  // StealthPaymentRouter
  rpcUrl: 'https://polygon-bor-rpc.publicnode.com',
}), (req, res) => {
  // Only reached after payment is verified
  res.json({
    temperature: 22.5,
    humidity: 65,
    condition: 'Partly Cloudy',
  });
});

app.listen(3001);`}
        </pre>
      </section>

      {/* Client Setup */}
      <section className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-5 w-5 text-primary-400" />
          <h2 className="text-xl font-semibold">3. Pay for Access (AI Agent)</h2>
        </div>
        <pre className="rounded-lg bg-gray-800 p-4 text-sm text-gray-300 overflow-x-auto">
{`import { payForAccess, loadAgentWallet } from '@stealthpay402/sdk';

// Load agent wallet
const wallet = loadAgentWallet(
  process.env.AGENT_PRIVATE_KEY,
  'https://polygon-bor-rpc.publicnode.com'
);

// Make paid API call with stealth privacy
const result = await payForAccess(
  'https://api.example.com/api/weather',
  {
    wallet,
    privatePayment: true,  // Use stealth addresses
    maxPayment: '1.00',    // Safety limit
  }
);

console.log(result.data);
// { temperature: 22.5, humidity: 65, ... }
console.log(result.paymentInfo);
// { amount: '0.01', stealthAddress: '0x...', private: true }`}
        </pre>
      </section>

      {/* Stealth Keys */}
      <section className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Code className="h-5 w-5 text-primary-400" />
          <h2 className="text-xl font-semibold">4. Generate Stealth Keys</h2>
        </div>
        <pre className="rounded-lg bg-gray-800 p-4 text-sm text-gray-300 overflow-x-auto">
{`import { generateStealthKeys } from '@stealthpay402/sdk';

// Generate stealth key pair (do this ONCE, store securely)
const keys = generateStealthKeys();

console.log(keys);
// {
//   spendingPrivateKey: '0x...',  // KEEP SECRET
//   viewingPrivateKey:  '0x...',  // KEEP SECRET
//   spendingPublicKey:  '0x02...', // 33 bytes, compressed
//   viewingPublicKey:   '0x03...', // 33 bytes, compressed
//   metaAddress:        '0x...',  // 66 bytes, publish this
// }

// Register meta-address on-chain so senders can find you
// Use StealthMetaRegistry.registerKeys(1, keys.metaAddress)`}
        </pre>
      </section>

      {/* Contract Addresses — dynamically read from contracts.ts */}
      <section className="card mb-6">
        <h2 className="text-xl font-semibold mb-4">Contract Addresses</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="py-2 text-left text-gray-500">Contract</th>
                <th className="py-2 text-left text-gray-500">Amoy (80002)</th>
                <th className="py-2 text-left text-gray-500">Mainnet (137)</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {CONTRACT_NAMES.map((name) => (
                <tr key={name} className="border-b border-gray-800/50">
                  <td className="py-2 font-sans text-sm">{name}</td>
                  <td className="py-2">
                    {formatAddress(amoyAddresses[name])}
                  </td>
                  <td className="py-2">
                    {formatAddressMainnet(mainnetAddresses[name])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-600">
          Addresses are auto-populated by the deployment script. Run <code className="text-gray-400">npm run deploy:amoy</code> to deploy.
        </p>
      </section>

      {/* Tech Stack */}
      <section className="card">
        <h2 className="text-xl font-semibold mb-4">Tech Stack</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { cat: "Smart Contracts", items: "Solidity 0.8.20, OpenZeppelin v5, Hardhat" },
            { cat: "Standards", items: "ERC-5564, ERC-6538, ERC-4626, EIP-3009, EIP-712" },
            { cat: "Frontend", items: "React 18, Vite, Tailwind CSS, Recharts, Zustand" },
            { cat: "SDK", items: "TypeScript, ethers.js v6, Express middleware" },
            { cat: "Networks", items: "Polygon Mainnet (137), Amoy (80002), zkEVM (2442)" },
            { cat: "Polygon Tech", items: "AggLayer, x402, Polygon ID, Katana" },
          ].map(({ cat, items }) => (
            <div key={cat} className="rounded-lg bg-gray-800/50 p-3">
              <div className="text-sm font-medium text-primary-400">{cat}</div>
              <div className="text-sm text-gray-400">{items}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
