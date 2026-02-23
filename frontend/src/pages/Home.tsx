import { Link } from "react-router-dom";
import {
  Shield,
  Zap,
  Eye,
  Globe,
  ArrowRight,
  Lock,
  Bot,
  Layers,
} from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "x402 Protocol",
    desc: "HTTP-native pay-per-request. AI agents pay for API access directly in HTTP headers — no subscriptions, no API keys.",
  },
  {
    icon: Eye,
    title: "ERC-5564 Stealth Addresses",
    desc: "One-time recipient addresses for every payment. Outside observers cannot link sender, receiver, or payment amounts.",
  },
  {
    icon: Lock,
    title: "EIP-3009 Gasless USDC",
    desc: "Agents sign payment authorizations off-chain. No gas required from the payer — facilitators submit on-chain.",
  },
  {
    icon: Bot,
    title: "AI Agent Registry",
    desc: "On-chain agent identity with reputation scores, daily spending limits, and transaction history.",
  },
  {
    icon: Layers,
    title: "ERC-4626 Fee Vault",
    desc: "Composable DeFi primitive for platform revenue. Transparent fee collection with DAO governance potential.",
  },
  {
    icon: Globe,
    title: "AggLayer Cross-Chain",
    desc: "Pay across Polygon chains — PoS, zkEVM, Katana — via AggLayer bridge. Unified privacy payments.",
  },
];

const steps = [
  { num: "1", title: "Agent Calls API", desc: "GET /api/data" },
  { num: "2", title: "Server Returns 402", desc: "Pay 0.01 USDC" },
  { num: "3", title: "Agent Signs Payment", desc: "EIP-3009 + Stealth" },
  { num: "4", title: "Router Processes", desc: "Fee + Route + Announce" },
  { num: "5", title: "Data Served", desc: "Privacy preserved" },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 via-transparent to-purple-900/10" />
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="badge-purple mb-4">Polygon Buildathon 2026</div>
          <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl">
            Privacy Payments for
            <br />
            <span className="bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
              AI Agents
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-400">
            x402 pay-per-request protocol with ERC-5564 stealth addresses.
            AI agents pay for APIs privately — no accounts, no tracking, no
            linked transactions. Built on Polygon.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/demo" className="btn-primary flex items-center gap-2 text-lg px-6 py-3">
              Try Live Demo
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/docs" className="btn-secondary text-lg px-6 py-3">
              View Docs
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-gray-800 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-10 text-center text-3xl font-bold">How It Works</h2>
          <div className="flex flex-col items-center gap-2 md:flex-row md:gap-0">
            {steps.map((step, i) => (
              <div key={step.num} className="flex items-center">
                <div className="card flex min-w-[180px] flex-col items-center p-4 text-center">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-lg font-bold">
                    {step.num}
                  </div>
                  <div className="text-sm font-medium">{step.title}</div>
                  <div className="text-xs text-gray-500">{step.desc}</div>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight className="hidden h-5 w-5 text-gray-600 md:block mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-10 text-center text-3xl font-bold">
            Built for Privacy, Payments, and Polygon
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="card group hover:border-primary-700 transition-colors">
                <f.icon className="mb-3 h-8 w-8 text-primary-400 group-hover:text-primary-300 transition-colors" />
                <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-gray-800 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { label: "Deployed Contracts", value: "8" },
              { label: "ERC Standards Used", value: "5" },
              { label: "Tests Passing", value: "99" },
              { label: "Platform Fee", value: "0.1%" },
            ].map((stat) => (
              <div key={stat.label} className="stat-card text-center">
                <div className="text-3xl font-bold text-primary-400">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
