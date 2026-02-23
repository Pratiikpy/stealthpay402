import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  Zap,
  Eye,
  Globe,
  ArrowRight,
  Lock,
  Bot,
  Layers,
  ExternalLink,
} from "lucide-react";
import { stagger, HoverCard } from "../components/ui/Motion";

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

const mainnetContracts = [
  { name: "Router", addr: "0x78308d47c2f534C4D51B35B1e1E95dFb689b9a86" },
  { name: "Announcer", addr: "0x1392C68fDD7EFF17b16F16350db834FA8FFFD40f" },
  { name: "MetaRegistry", addr: "0x0709857a1556C194637D7b6Aa9bD230744985c9D" },
  { name: "FeeVault", addr: "0x0D0FfD08A799182CEBaae665cC84d7ae0260194b" },
  { name: "AgentRegistry", addr: "0xAD60dCBb80Bc71EF9Ee1463a5842aC1354A3d6b5" },
  { name: "Compliance", addr: "0x49dc97c79DD786008f5b8059366C4bbB91357D5F" },
  { name: "CrossChain", addr: "0x18Aade5d6368eA5171217D91634a92c2EBDDF5E9" },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/20 via-transparent to-purple-900/10" />
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="badge-purple mb-4">Live on Polygon Mainnet</div>
          </motion.div>

          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="mx-auto mb-6 w-fit"
          >
            <Shield className="h-12 w-12 text-primary-400" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 text-5xl font-bold tracking-tight md:text-6xl"
          >
            Privacy Payments for
            <br />
            <span className="bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
              AI Agents
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mx-auto mb-8 max-w-2xl text-lg text-gray-400"
          >
            x402 pay-per-request protocol with ERC-5564 stealth addresses.
            AI agents pay for APIs privately — no accounts, no tracking, no
            linked transactions. Built on Polygon.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex items-center justify-center gap-4"
          >
            <Link
              to="/demo"
              className="btn-primary flex items-center gap-2 text-lg px-6 py-3"
            >
              Try Live Demo
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link to="/docs" className="btn-secondary text-lg px-6 py-3">
              View Docs
            </Link>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-gray-800 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-10 text-center text-3xl font-bold"
          >
            How It Works
          </motion.h2>
          <motion.div
            variants={stagger.container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="flex flex-col items-center gap-2 md:flex-row md:gap-0"
          >
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                variants={stagger.item}
                className="flex items-center"
              >
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
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-10 text-center text-3xl font-bold"
          >
            Built for Privacy, Payments, and Polygon
          </motion.h2>
          <motion.div
            variants={stagger.container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((f) => (
              <motion.div key={f.title} variants={stagger.item}>
                <HoverCard>
                  <div className="card group hover:border-primary-700 transition-colors h-full">
                    <f.icon className="mb-3 h-8 w-8 text-primary-400 group-hover:text-primary-300 transition-colors" />
                    <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                    <p className="text-sm text-gray-400">{f.desc}</p>
                  </div>
                </HoverCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-gray-800 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <motion.div
            variants={stagger.container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-2 gap-6 md:grid-cols-4"
          >
            {[
              { label: "Deployed Contracts", value: "8" },
              { label: "ERC Standards Used", value: "5" },
              { label: "Tests Passing", value: "99" },
              { label: "Platform Fee", value: "0.1%" },
            ].map((stat) => (
              <motion.div key={stat.label} variants={stagger.item}>
                <HoverCard>
                  <div className="stat-card text-center">
                    <div className="text-3xl font-bold text-primary-400">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-500">{stat.label}</div>
                  </div>
                </HoverCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Deployed on Mainnet */}
      <section className="border-t border-gray-800 py-12">
        <div className="mx-auto max-w-7xl px-4">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-6 text-center text-2xl font-bold"
          >
            Deployed on Polygon Mainnet
          </motion.h2>
          <motion.div
            variants={stagger.container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"
          >
            {mainnetContracts.map((c) => (
              <motion.div key={c.name} variants={stagger.item}>
                <a
                  href={`https://polygonscan.com/address/${c.addr}#code`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 p-3 hover:border-primary-600 transition-colors group"
                >
                  <div>
                    <div className="text-xs text-gray-500">{c.name}</div>
                    <div className="font-mono text-xs text-primary-400 group-hover:text-primary-300">
                      {c.addr.slice(0, 6)}...{c.addr.slice(-4)}
                    </div>
                  </div>
                  <ExternalLink className="h-3 w-3 text-gray-600 group-hover:text-primary-400 transition-colors" />
                </a>
              </motion.div>
            ))}
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-4 flex flex-col items-center gap-2"
          >
            <p className="text-xs text-gray-600">
              All contracts verified with full source code on Polygonscan
            </p>
            <a
              href="https://polygonscan.com/tx/0xdf5edc40df3728f795d2d78c1fa9c4bd53b971bb24d1027eb9a4590617a0caeb"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-400 hover:underline flex items-center gap-1"
            >
              Mainnet E2E Payment TX
              <ExternalLink className="h-3 w-3" />
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
