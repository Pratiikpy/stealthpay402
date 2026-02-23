import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import {
  CONTRACT_ADDRESSES,
  ROUTER_ABI,
  ANNOUNCER_ABI,
  AGENT_REGISTRY_ABI,
  FEE_VAULT_ABI,
} from "../lib/contracts";

interface PaymentEvent {
  from: string;
  stealthAddress: string;
  amount: string;
  fee: string;
  nonce: string;
  txHash: string;
  blockNumber: number;
  timestamp?: number;
}

interface DashboardStats {
  totalPayments: number;
  totalVolume: number;
  totalFees: number;
  totalAgents: number;
  recentPayments: PaymentEvent[];
  dailyVolumes: { day: string; volume: number; payments: number }[];
}

const EMPTY_STATS: DashboardStats = {
  totalPayments: 0,
  totalVolume: 0,
  totalFees: 0,
  totalAgents: 0,
  recentPayments: [],
  dailyVolumes: [],
};

/**
 * Query on-chain data from StealthPay402 contracts.
 * Works with any chain that has deployed contracts.
 */
export function useContractData(rpcUrl: string, chainId: number) {
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addresses = CONTRACT_ADDRESSES[chainId];

  const fetchStats = useCallback(async () => {
    if (!addresses || !addresses.StealthPaymentRouter) {
      setError("No contracts deployed on this chain yet");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const router = new ethers.Contract(addresses.StealthPaymentRouter, ROUTER_ABI, provider);
      const announcer = new ethers.Contract(addresses.StealthAnnouncer, ANNOUNCER_ABI, provider);

      // Query recent PaymentProcessed events (last 5000 blocks)
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 5000);

      const paymentFilter = router.filters.PaymentProcessed();
      const events = await router.queryFilter(paymentFilter, fromBlock, latestBlock);

      // Parse payment events
      let totalVolume = 0;
      let totalFees = 0;
      const recentPayments: PaymentEvent[] = [];
      const dailyMap: Record<string, { volume: number; payments: number }> = {};

      for (const event of events) {
        const log = event as ethers.EventLog;
        const from = log.args[0] as string;
        const stealthAddr = log.args[1] as string;
        const amount = Number(ethers.formatUnits(log.args[2] as bigint, 6));
        const fee = Number(ethers.formatUnits(log.args[3] as bigint, 6));
        const nonce = log.args[4] as string;

        totalVolume += amount;
        totalFees += fee;

        recentPayments.push({
          from,
          stealthAddress: stealthAddr,
          amount: amount.toFixed(2),
          fee: fee.toFixed(4),
          nonce,
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
        });

        // Group by day for chart
        const block = await provider.getBlock(log.blockNumber);
        if (block) {
          const day = new Date(block.timestamp * 1000).toLocaleDateString("en-US", { weekday: "short" });
          if (!dailyMap[day]) dailyMap[day] = { volume: 0, payments: 0 };
          dailyMap[day].volume += amount;
          dailyMap[day].payments += 1;
        }
      }

      // Get total agents if registry is deployed
      let totalAgents = 0;
      if (addresses.AgentRegistry) {
        try {
          const agentRegistry = new ethers.Contract(addresses.AgentRegistry, AGENT_REGISTRY_ABI, provider);
          totalAgents = Number(await agentRegistry.totalAgents());
        } catch { /* registry might not be linked yet */ }
      }

      // Get announcement count
      let announcementCount = 0;
      try {
        announcementCount = Number(await announcer.announcementCount());
      } catch { /* announcer might not be deployed yet */ }

      const dailyVolumes = Object.entries(dailyMap).map(([day, data]) => ({
        day,
        volume: Math.round(data.volume * 100) / 100,
        payments: data.payments,
      }));

      setStats({
        totalPayments: events.length,
        totalVolume: Math.round(totalVolume * 100) / 100,
        totalFees: Math.round(totalFees * 10000) / 10000,
        totalAgents,
        recentPayments: recentPayments.reverse().slice(0, 10),
        dailyVolumes,
      });
    } catch (err: any) {
      setError(err.message || "Failed to fetch contract data");
    } finally {
      setLoading(false);
    }
  }, [rpcUrl, chainId, addresses]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}
