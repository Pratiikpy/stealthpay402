import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Users,
  DollarSign,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Shield,
  Zap,
  ExternalLink,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ethers } from "ethers";
import { useContractData } from "../hooks/useContractData";
import { CONTRACT_ADDRESSES, ANNOUNCER_ABI, AGENT_REGISTRY_ABI, FEE_VAULT_ABI, ROUTER_ABI } from "../lib/contracts";
import { PageTransition, stagger, HoverCard } from "../components/ui/Motion";
import { Skeleton, StatCardSkeleton } from "../components/ui/Skeleton";
import { CopyButton } from "../components/ui/CopyButton";

const CHAIN_OPTIONS = [
  { id: 137, name: "Polygon Mainnet", rpc: "https://polygon-bor-rpc.publicnode.com" },
  { id: 80002, name: "Amoy Testnet", rpc: "https://rpc-amoy.polygon.technology" },
];

interface ProtocolStats {
  platformFee: string;
  totalAnnouncements: number;
  totalAgents: number;
  feeVaultAssets: string;
}

interface ActivityEvent {
  type: "payment" | "agent" | "announcement";
  description: string;
  blockNumber: number;
  txHash: string;
}

export default function DashboardPage() {
  const [selectedChain, setSelectedChain] = useState(CHAIN_OPTIONS[0]);
  const [protocolStats, setProtocolStats] = useState<ProtocolStats | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);

  const hasContracts = !!(
    CONTRACT_ADDRESSES[selectedChain.id]?.StealthPaymentRouter
  );

  const { stats, loading, error, refetch } = useContractData(
    selectedChain.rpc,
    selectedChain.id
  );

  const explorer = selectedChain.id === 137 ? "https://polygonscan.com" : "https://amoy.polygonscan.com";

  // Fetch protocol stats & activity feed
  useEffect(() => {
    const fetchProtocol = async () => {
      const addresses = CONTRACT_ADDRESSES[selectedChain.id];
      if (!addresses?.StealthPaymentRouter) return;

      try {
        const provider = new ethers.JsonRpcProvider(selectedChain.rpc, selectedChain.id, { staticNetwork: true });

        const router = new ethers.Contract(addresses.StealthPaymentRouter, ROUTER_ABI, provider);
        const announcer = new ethers.Contract(addresses.StealthAnnouncer, ANNOUNCER_ABI, provider);

        const [feeBps, annCount] = await Promise.all([
          router.platformFeeBps().catch(() => 10n),
          announcer.announcementCount().catch(() => 0n),
        ]);

        let agentCount = 0;
        let vaultAssets = "0";
        if (addresses.AgentRegistry) {
          try {
            const reg = new ethers.Contract(addresses.AgentRegistry, AGENT_REGISTRY_ABI, provider);
            agentCount = Number(await reg.totalAgents());
          } catch {}
        }
        if (addresses.FeeVault) {
          try {
            const vault = new ethers.Contract(addresses.FeeVault, FEE_VAULT_ABI, provider);
            const assets = await vault.totalAssets();
            vaultAssets = ethers.formatUnits(assets, 6);
          } catch {}
        }

        setProtocolStats({
          platformFee: `${Number(feeBps) / 100}%`,
          totalAnnouncements: Number(annCount),
          totalAgents: agentCount,
          feeVaultAssets: vaultAssets,
        });

        // Activity feed — merge events
        const latestBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latestBlock - 10000);
        const events: ActivityEvent[] = [];

        try {
          const paymentEvents = await router.queryFilter(router.filters.PaymentProcessed(), fromBlock, latestBlock);
          for (const e of paymentEvents) {
            const log = e as ethers.EventLog;
            const from = log.args[0] as string;
            const amount = ethers.formatUnits(log.args[2] as bigint, 6);
            events.push({
              type: "payment",
              description: `${from.slice(0, 6)}...${from.slice(-4)} paid ${amount} USDC`,
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
            });
          }
        } catch {}

        try {
          const annEvents = await announcer.queryFilter(announcer.filters.Announcement(), fromBlock, latestBlock);
          for (const e of annEvents) {
            const log = e as ethers.EventLog;
            const stealth = log.args[1] as string;
            events.push({
              type: "announcement",
              description: `Stealth announcement → ${stealth.slice(0, 6)}...${stealth.slice(-4)}`,
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
            });
          }
        } catch {}

        if (addresses.AgentRegistry) {
          try {
            const reg = new ethers.Contract(addresses.AgentRegistry, AGENT_REGISTRY_ABI, provider);
            const agentEvents = await reg.queryFilter(reg.filters.AgentRegistered(), fromBlock, latestBlock);
            for (const e of agentEvents) {
              const log = e as ethers.EventLog;
              const agent = log.args[0] as string;
              events.push({
                type: "agent",
                description: `Agent registered: ${agent.slice(0, 6)}...${agent.slice(-4)}`,
                blockNumber: log.blockNumber,
                txHash: log.transactionHash,
              });
            }
          } catch {}
        }

        events.sort((a, b) => b.blockNumber - a.blockNumber);
        setActivityFeed(events.slice(0, 10));
      } catch {}
    };
    fetchProtocol();
  }, [selectedChain]);

  const statCards = [
    {
      icon: DollarSign,
      label: "Total Volume",
      value: stats.totalVolume > 0 ? `$${stats.totalVolume.toLocaleString()}` : "$0",
    },
    {
      icon: Activity,
      label: "Total Payments",
      value: stats.totalPayments.toLocaleString(),
    },
    {
      icon: Users,
      label: "Registered Agents",
      value: stats.totalAgents.toLocaleString(),
    },
    {
      icon: TrendingUp,
      label: "Fees Collected",
      value: stats.totalFees > 0 ? `$${stats.totalFees.toFixed(4)}` : "$0",
    },
  ];

  return (
    <PageTransition>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-3">
            <select
              value={selectedChain.id}
              onChange={(e) => {
                const chain = CHAIN_OPTIONS.find((c) => c.id === Number(e.target.value));
                if (chain) setSelectedChain(chain);
              }}
              className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300"
            >
              {CHAIN_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
            <button
              onClick={refetch}
              disabled={loading}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>
        </div>

        {!hasContracts && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-yellow-800 bg-yellow-900/10 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="text-sm text-yellow-400">
              Contracts not yet deployed on {selectedChain.name}
            </div>
          </div>
        )}

        {error && hasContracts && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-800 bg-red-900/10 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="text-sm text-red-400">{error}</div>
          </div>
        )}

        {/* Stats Grid */}
        <motion.div
          variants={stagger.container}
          initial="hidden"
          animate="show"
          className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <motion.div key={i} variants={stagger.item}>
                  <StatCardSkeleton />
                </motion.div>
              ))
            : statCards.map((stat) => (
                <motion.div key={stat.label} variants={stagger.item}>
                  <HoverCard>
                    <div className="stat-card">
                      <div className="flex items-center justify-between">
                        <stat.icon className="h-5 w-5 text-gray-500" />
                      </div>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <div className="text-sm text-gray-500">{stat.label}</div>
                    </div>
                  </HoverCard>
                </motion.div>
              ))}
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card lg:col-span-2"
          >
            <h2 className="mb-4 text-lg font-semibold">Payment Volume</h2>
            {stats.dailyVolumes.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={stats.dailyVolumes}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#f3f4f6",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="#7c3aed"
                    fillOpacity={1}
                    fill="url(#colorVolume)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-gray-500">
                {loading ? (
                  <div className="space-y-3 w-full px-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <div className="text-center">
                    <Activity className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                    <p>No payment data yet</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Chart will populate when payments are processed on-chain
                    </p>
                  </div>
                )}
              </div>
            )}
          </motion.div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Recent Payments */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card"
            >
              <h2 className="mb-4 text-lg font-semibold">Recent Payments</h2>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              ) : stats.recentPayments.length > 0 ? (
                <motion.div
                  variants={stagger.container}
                  initial="hidden"
                  animate="show"
                  className="space-y-3"
                >
                  {stats.recentPayments.map((p) => (
                    <motion.div
                      key={p.nonce}
                      variants={stagger.item}
                      className="flex items-center justify-between rounded-lg bg-gray-800/50 px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-mono">
                          {p.from.slice(0, 6)}...{p.from.slice(-4)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Block {p.blockNumber.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-green-400">
                        ${p.amount}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="flex h-24 items-center justify-center text-sm text-gray-500">
                  No payments found on this chain
                </div>
              )}
            </motion.div>

            {/* Protocol Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="card"
            >
              <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary-400" />
                Protocol Stats
              </h2>
              {protocolStats ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Platform Fee</span>
                    <span>{protocolStats.platformFee}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Announcements</span>
                    <span className="text-primary-400">{protocolStats.totalAnnouncements}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Agents</span>
                    <span>{protocolStats.totalAgents}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">FeeVault</span>
                    <span>${protocolStats.feeVaultAssets} USDC</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Live Activity Feed */}
        {activityFeed.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="card mt-6"
          >
            <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary-400" />
              Live Activity
            </h2>
            <motion.div
              variants={stagger.container}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              {activityFeed.map((event, i) => (
                <motion.div
                  key={`${event.txHash}-${i}`}
                  variants={stagger.item}
                  className="flex items-center justify-between rounded-lg bg-gray-800/30 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        event.type === "payment"
                          ? "bg-green-400"
                          : event.type === "agent"
                          ? "bg-blue-400"
                          : "bg-purple-400"
                      }`}
                    />
                    <span className="text-gray-300">{event.description}</span>
                  </div>
                  <a
                    href={`${explorer}/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-400"
                  >
                    {event.blockNumber.toLocaleString()}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}
