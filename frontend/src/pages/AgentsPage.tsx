import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bot, Loader2, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";
import { ethers } from "ethers";
import { PageTransition, stagger, HoverCard } from "../components/ui/Motion";
import { CopyButton } from "../components/ui/CopyButton";
import { CONTRACT_ADDRESSES, AGENT_REGISTRY_ABI } from "../lib/contracts";

const CHAIN_OPTIONS = [
  { id: 137, name: "Polygon Mainnet", rpc: "https://polygon-bor-rpc.publicnode.com" },
  { id: 80002, name: "Amoy Testnet", rpc: "https://rpc-amoy.polygon.technology" },
];

interface AgentData {
  address: string;
  metadataHash: string;
  dailySpendLimit: string;
  spentToday: string;
  reputationScore: number;
  totalTransactions: number;
  totalVolume: string;
  isActive: boolean;
  registeredAt: number;
  blockNumber: number;
}

export default function AgentsPage() {
  const [selectedChain, setSelectedChain] = useState(CHAIN_OPTIONS[0]);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [totalAgents, setTotalAgents] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const explorer = selectedChain.id === 137 ? "https://polygonscan.com" : "https://amoy.polygonscan.com";
  const addresses = CONTRACT_ADDRESSES[selectedChain.id];

  const fetchAgents = async () => {
    if (!addresses?.AgentRegistry) {
      setError("AgentRegistry not deployed on this chain");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = new ethers.JsonRpcProvider(selectedChain.rpc, selectedChain.id, { staticNetwork: true });
      const registry = new ethers.Contract(addresses.AgentRegistry, AGENT_REGISTRY_ABI, provider);

      const count = Number(await registry.totalAgents());
      setTotalAgents(count);

      // Query AgentRegistered events
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 50000);
      const filter = registry.filters.AgentRegistered();
      const events = await registry.queryFilter(filter, fromBlock, latestBlock);

      const agentList: AgentData[] = [];

      for (const event of events) {
        const log = event as ethers.EventLog;
        const agentAddr = log.args[0] as string;

        try {
          const data = await registry.getAgent(agentAddr);
          agentList.push({
            address: agentAddr,
            metadataHash: data.metadataHash,
            dailySpendLimit: ethers.formatUnits(data.dailySpendLimit, 6),
            spentToday: ethers.formatUnits(data.spentToday, 6),
            reputationScore: Number(data.reputationScore),
            totalTransactions: Number(data.totalTransactions),
            totalVolume: ethers.formatUnits(data.totalVolume, 6),
            isActive: data.isActive,
            registeredAt: Number(data.registeredAt),
            blockNumber: log.blockNumber,
          });
        } catch {
          // Agent data fetch failed, skip
        }
      }

      setAgents(agentList);
    } catch (err: any) {
      setError(err.message || "Failed to fetch agents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [selectedChain]);

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Registered Agents</h1>
            <p className="mt-1 text-gray-400">
              On-chain AI agent identities with reputation scores and transaction history.
            </p>
          </div>
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
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={fetchAgents}
              disabled={loading}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>

        {/* Total count */}
        <div className="mb-6 flex items-center gap-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-2 text-sm">
            <span className="text-gray-400">Total Agents: </span>
            <span className="font-mono text-primary-400">{totalAgents}</span>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-2 text-sm">
            <span className="text-gray-400">Network: </span>
            <span className="font-mono text-green-400">{selectedChain.name}</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-800 bg-red-900/10 px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            <div className="text-sm text-red-400">{error}</div>
          </div>
        )}

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
          </div>
        ) : agents.length > 0 ? (
          <motion.div
            variants={stagger.container}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {agents.map((agent) => (
              <motion.div key={agent.address} variants={stagger.item}>
                <HoverCard>
                  <div className="card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary-400" />
                        <a
                          href={`${explorer}/address/${agent.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-sm text-primary-400 hover:underline"
                        >
                          {agent.address.slice(0, 10)}...{agent.address.slice(-8)}
                        </a>
                        <CopyButton text={agent.address} />
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          agent.isActive
                            ? "bg-green-900/50 text-green-400"
                            : "bg-red-900/50 text-red-400"
                        }`}
                      >
                        {agent.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <div>
                        <div className="text-xs text-gray-500">Reputation</div>
                        <div className="font-semibold">{agent.reputationScore}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Transactions</div>
                        <div className="font-semibold">{agent.totalTransactions}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Volume</div>
                        <div className="font-semibold">${agent.totalVolume}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Daily Limit</div>
                        <div className="font-semibold">${agent.dailySpendLimit}</div>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-600">
                      Registered at block {agent.blockNumber.toLocaleString()}
                    </div>
                  </div>
                </HoverCard>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="card text-center py-12">
            <Bot className="mx-auto mb-3 h-10 w-10 text-gray-600" />
            <p className="text-gray-400 mb-1">No agents registered yet</p>
            <p className="text-xs text-gray-600">
              Agents register via{" "}
              <code className="rounded bg-gray-800 px-1 text-gray-400">
                AgentRegistry.registerAgent()
              </code>
            </p>
            <a
              href={`${explorer}/address/${addresses?.AgentRegistry}#writeContract`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary-400 hover:underline"
            >
              View contract on Polygonscan <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
