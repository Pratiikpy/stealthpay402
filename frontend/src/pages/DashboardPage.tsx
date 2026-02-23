import { useState } from "react";
import {
  Activity,
  Users,
  DollarSign,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Loader2,
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
import { useContractData } from "../hooks/useContractData";
import { CONTRACT_ADDRESSES } from "../lib/contracts";

const CHAIN_OPTIONS = [
  { id: 80002, name: "Amoy Testnet", rpc: "https://rpc-amoy.polygon.technology" },
  { id: 137, name: "Polygon Mainnet", rpc: "https://polygon-rpc.com" },
];

export default function DashboardPage() {
  const [selectedChain, setSelectedChain] = useState(CHAIN_OPTIONS[0]);

  const hasContracts = !!(
    CONTRACT_ADDRESSES[selectedChain.id]?.StealthPaymentRouter
  );

  const { stats, loading, error, refetch } = useContractData(
    selectedChain.rpc,
    selectedChain.id
  );

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
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          {/* Chain selector */}
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

      {/* Chain status */}
      {!hasContracts && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-yellow-800 bg-yellow-900/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-yellow-400" />
          <div>
            <div className="text-sm font-medium text-yellow-400">
              Contracts not yet deployed on {selectedChain.name}
            </div>
            <div className="text-xs text-gray-400">
              Deploy contracts with <code className="text-gray-300">npm run deploy:amoy</code> then
              update addresses in <code className="text-gray-300">frontend/src/lib/contracts.ts</code>
            </div>
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
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between">
              <stat.icon className="h-5 w-5 text-gray-500" />
              {loading && <Loader2 className="h-3 w-3 animate-spin text-gray-600" />}
            </div>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-sm text-gray-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chart */}
        <div className="card lg:col-span-2">
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
                <Loader2 className="h-8 w-8 animate-spin" />
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
        </div>

        {/* Recent Payments */}
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Recent Payments</h2>
          {stats.recentPayments.length > 0 ? (
            <div className="space-y-3">
              {stats.recentPayments.map((p) => (
                <div
                  key={p.nonce}
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
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-gray-500">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                "No payments found on this chain"
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
