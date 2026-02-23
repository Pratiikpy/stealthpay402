import { useState, useCallback } from "react";
import { ethers } from "ethers";

// RPC endpoints for read-only queries (no wallet needed)
const RPC_URLS: Record<number, string> = {
  137: "https://polygon-rpc.com",
  80002: "https://rpc-amoy.polygon.technology",
};

/**
 * Hook for connecting browser wallets (MetaMask, etc.) and
 * providing read-only RPC access for contract queries.
 */
export function useWeb3() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number>(80002); // Default to Amoy
  const [connecting, setConnecting] = useState(false);

  const getReadProvider = useCallback((chain?: number) => {
    const id = chain || chainId;
    const rpcUrl = RPC_URLS[id] || RPC_URLS[80002];
    return new ethers.JsonRpcProvider(rpcUrl);
  }, [chainId]);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("No wallet found. Install MetaMask.");
    }

    setConnecting(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();

      setAddress(accounts[0]);
      setChainId(Number(network.chainId));

      // Listen for account/chain changes
      (window as any).ethereum.on("accountsChanged", (accs: string[]) => {
        setAddress(accs[0] || null);
      });
      (window as any).ethereum.on("chainChanged", (id: string) => {
        setChainId(parseInt(id, 16));
      });

      return { address: accounts[0], chainId: Number(network.chainId), provider };
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  return {
    address,
    chainId,
    connecting,
    connect,
    disconnect,
    getReadProvider,
    isConnected: !!address,
  };
}
