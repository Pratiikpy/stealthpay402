import { create } from "zustand";

interface Agent {
  address: string;
  metadataHash: string;
  reputationScore: number;
  totalTransactions: number;
  totalVolume: string;
  isActive: boolean;
  registeredAt: number;
}

interface AgentStore {
  agents: Agent[];
  totalAgents: number;
  connectedAddress: string | null;
  isRegistered: boolean;
  setAgents: (agents: Agent[]) => void;
  setConnectedAddress: (address: string | null) => void;
  setIsRegistered: (registered: boolean) => void;
  setTotalAgents: (count: number) => void;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  totalAgents: 0,
  connectedAddress: null,
  isRegistered: false,
  setAgents: (agents) => set({ agents }),
  setConnectedAddress: (address) => set({ connectedAddress: address }),
  setIsRegistered: (registered) => set({ isRegistered: registered }),
  setTotalAgents: (count) => set({ totalAgents: count }),
}));
