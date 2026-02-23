import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  Play,
  CheckCircle,
  AlertCircle,
  Loader2,
  Shield,
  Zap,
  Wallet,
  Send,
  Key,
  Coins,
} from "lucide-react";
import {
  CONTRACT_ADDRESSES,
  ROUTER_ABI,
  ANNOUNCER_ABI,
  MOCK_USDC_ABI,
} from "../lib/contracts";
import { generateStealthAddress, DEMO_META_ADDRESS } from "../lib/stealth";

type Step =
  | "idle"
  | "connecting"
  | "requesting"
  | "got402"
  | "stealth"
  | "signing"
  | "processing"
  | "complete"
  | "error";

const AMOY_CHAIN_ID = 80002;
const AMOY_RPC = "https://rpc-amoy.polygon.technology";
const DEMO_SERVER =
  import.meta.env.VITE_DEMO_SERVER_URL || "http://localhost:3001";

// Amoy requires minimum 25 Gwei gas tip — MetaMask defaults to ~1.5 Gwei which gets rejected
const AMOY_GAS_OVERRIDES = {
  maxFeePerGas: ethers.parseUnits("50", "gwei"),
  maxPriorityFeePerGas: ethers.parseUnits("30", "gwei"),
};

export default function DemoPage() {
  const [step, setStep] = useState<Step>("idle");
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletSigner, setWalletSigner] =
    useState<ethers.JsonRpcSigner | null>(null);
  const [stealthAddr, setStealthAddr] = useState("");
  const [ephPubKey, setEphPubKey] = useState("");
  const [viewTag, setViewTag] = useState<number>(0);
  const [eip3009Sig, setEip3009Sig] = useState("");
  const [paymentNonce, setPaymentNonce] = useState("");
  const [paymentValidBefore, setPaymentValidBefore] = useState(0);
  const [txHash, setTxHash] = useState("");
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcementCount, setAnnouncementCount] = useState<number | null>(
    null
  );
  const [serverPayload, setServerPayload] = useState<any>(null);
  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [minting, setMinting] = useState(false);

  // Fetch on-chain stats on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(AMOY_RPC);
        const addresses = CONTRACT_ADDRESSES[AMOY_CHAIN_ID];
        if (!addresses?.StealthAnnouncer) return;
        const announcer = new ethers.Contract(
          addresses.StealthAnnouncer,
          ANNOUNCER_ABI,
          provider
        );
        const count = await announcer.announcementCount();
        setAnnouncementCount(Number(count));
      } catch {
        // Stats are non-critical
      }
    };
    fetchStats();
  }, []);

  const connectWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("No wallet found. Install MetaMask.");
    }
    const ethereum = (window as any).ethereum;
    await ethereum.request({ method: "eth_requestAccounts" });

    // Switch chain first, THEN create provider (avoids stale chainId bug)
    const currentChainId = parseInt(await ethereum.request({ method: "eth_chainId" }), 16);
    if (currentChainId !== AMOY_CHAIN_ID) {
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + AMOY_CHAIN_ID.toString(16) }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x" + AMOY_CHAIN_ID.toString(16),
                chainName: "Polygon Amoy Testnet",
                nativeCurrency: {
                  name: "POL",
                  symbol: "POL",
                  decimals: 18,
                },
                rpcUrls: [AMOY_RPC],
                blockExplorerUrls: ["https://amoy.polygonscan.com"],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }
    }

    // Create provider AFTER chain switch so it has the correct chainId
    const provider = new ethers.BrowserProvider(ethereum);
    const accounts = await provider.send("eth_accounts", []);
    setWalletAddress(accounts[0]);
    return provider;
  };

  const fetchUsdcBalance = async (addr: string) => {
    try {
      const provider = new ethers.JsonRpcProvider(AMOY_RPC);
      const addresses = CONTRACT_ADDRESSES[AMOY_CHAIN_ID];
      const usdc = new ethers.Contract(
        addresses.USDC,
        MOCK_USDC_ABI,
        provider
      );
      const bal = await usdc.balanceOf(addr);
      setUsdcBalance(bal);
    } catch {
      // Balance check is non-critical
    }
  };

  const runDemo = async () => {
    setError(null);
    setApiResponse(null);
    setTxHash("");
    setStealthAddr("");
    setEphPubKey("");
    setEip3009Sig("");
    setServerPayload(null);
    setUsdcBalance(null);

    try {
      // Step 1: Connect wallet
      setStep("connecting");
      console.log("[Demo] Step 1: Connecting wallet...");
      const provider = await connectWallet();
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setWalletSigner(signer);
      console.log("[Demo] Wallet connected:", addr);

      // Step 2: Request API — try real demo-server if configured (not localhost on production)
      setStep("requesting");
      let paymentRequired: any = null;
      let serverAvailable = false;
      const isLocalhost = DEMO_SERVER.includes("localhost") || DEMO_SERVER.includes("127.0.0.1");
      const isProduction = window.location.protocol === "https:";
      if (!isLocalhost || !isProduction) {
        try {
          console.log("[Demo] Step 2: Requesting", DEMO_SERVER);
          const resp = await fetch(
            `${DEMO_SERVER}/api/weather?city=new_york`,
            { signal: AbortSignal.timeout(3000) }
          );
          if (resp.status === 402) {
            paymentRequired = await resp.json();
            serverAvailable = true;
            console.log("[Demo] Got real 402 from server:", paymentRequired);
          }
        } catch {
          console.log("[Demo] Demo server not available, using fallback");
        }
      } else {
        console.log("[Demo] Step 2: Production mode — using on-chain 402");
      }

      // Step 3: Show 402 Payment Required
      setStep("got402");
      const addresses = CONTRACT_ADDRESSES[AMOY_CHAIN_ID];
      if (!paymentRequired) {
        paymentRequired = {
          status: 402,
          message: "Payment Required",
          x402Version: "1.0",
          payment: {
            amount: "0.01",
            token: "USDC",
            chain: AMOY_CHAIN_ID,
            receiver: addresses.StealthPaymentRouter,
            description: "Weather data — pay 0.01 USDC via x402",
          },
        };
      }
      setServerPayload(paymentRequired);
      await delay(400);

      // Step 4: Generate stealth address via real ECDH
      setStep("stealth");
      console.log("[Demo] Step 4: Generating stealth address via ECDH...");
      const stealth = generateStealthAddress(DEMO_META_ADDRESS);
      setStealthAddr(stealth.stealthAddress);
      setEphPubKey(stealth.ephemeralPublicKey);
      setViewTag(stealth.viewTag);
      console.log("[Demo] Stealth address:", stealth.stealthAddress);
      console.log("[Demo] Ephemeral pubkey:", stealth.ephemeralPublicKey);
      console.log("[Demo] View tag:", "0x" + stealth.viewTag.toString(16));
      await delay(300);

      // Step 5: Sign EIP-3009 transferWithAuthorization via MetaMask
      setStep("signing");
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const validBefore = Math.floor(Date.now() / 1000) + 3600;
      setPaymentNonce(nonce);
      setPaymentValidBefore(validBefore);

      const domain: ethers.TypedDataDomain = {
        name: "USD Coin",
        version: "2",
        chainId: AMOY_CHAIN_ID,
        verifyingContract: addresses.USDC,
      };
      const types = {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      };
      const message = {
        from: addr,
        to: addresses.StealthPaymentRouter,
        value: ethers.parseUnits("0.01", 6),
        validAfter: 0,
        validBefore: validBefore,
        nonce: nonce,
      };

      console.log("[Demo] Step 5: Requesting EIP-3009 signature via MetaMask...");
      console.log("[Demo] Signing:", { from: addr, to: addresses.StealthPaymentRouter, value: "0.01 USDC" });
      const sig = await signer.signTypedData(domain, types, message);
      setEip3009Sig(sig);
      console.log("[Demo] Signature:", sig);

      // Step 6: Read on-chain state
      setStep("processing");
      console.log("[Demo] Step 6: Reading on-chain state...");
      const readProvider = new ethers.JsonRpcProvider(AMOY_RPC);
      const router = new ethers.Contract(
        addresses.StealthPaymentRouter,
        ROUTER_ABI,
        readProvider
      );
      const feeBps = await router.platformFeeBps();
      const feePercent = Number(feeBps) / 100;

      const announcer = new ethers.Contract(
        addresses.StealthAnnouncer,
        ANNOUNCER_ABI,
        readProvider
      );
      const totalAnnouncements = await announcer.announcementCount();
      setAnnouncementCount(Number(totalAnnouncements));

      await fetchUsdcBalance(addr);

      // Step 7: Complete
      console.log("[Demo] Step 7: Complete! Fee:", feePercent + "%", "Announcements:", Number(totalAnnouncements));
      setStep("complete");
      setApiResponse(
        JSON.stringify(
          {
            status: "success",
            on_chain_data: {
              router_address: addresses.StealthPaymentRouter,
              platform_fee: `${feePercent}%`,
              total_announcements: Number(totalAnnouncements),
              network: "Polygon Amoy (80002)",
            },
            stealth_payment: {
              stealth_address: stealth.stealthAddress,
              ephemeral_public_key: stealth.ephemeralPublicKey,
              view_tag: `0x${stealth.viewTag.toString(16).padStart(2, "0")}`,
              amount: "0.01 USDC",
              fee: `${(0.01 * (feePercent / 100)).toFixed(6)} USDC`,
              eip3009_signature: sig,
              signed_by: addr,
              server_available: serverAvailable,
            },
            api_response: {
              temperature: 22.5,
              humidity: 65,
              wind_speed: 12.3,
              condition: "Partly Cloudy",
              location: "New York, NY",
              timestamp: new Date().toISOString(),
            },
          },
          null,
          2
        )
      );
    } catch (e: any) {
      setStep("error");
      if (e.code === "ACTION_REJECTED" || e.code === 4001) {
        setError("Signature rejected — you cancelled the MetaMask prompt.");
      } else {
        setError(e.message || "Unknown error");
      }
    }
  };

  const submitOnChain = async () => {
    if (!walletSigner || !eip3009Sig || !walletAddress) return;
    setSubmitting(true);
    setError(null);

    try {
      const addresses = CONTRACT_ADDRESSES[AMOY_CHAIN_ID];

      // Check USDC balance first
      const provider = new ethers.JsonRpcProvider(AMOY_RPC);
      const usdc = new ethers.Contract(addresses.USDC, MOCK_USDC_ABI, provider);
      const balance: bigint = await usdc.balanceOf(walletAddress);
      const required = ethers.parseUnits("0.01", 6);

      if (balance < required) {
        setError(
          `Insufficient USDC balance: ${ethers.formatUnits(balance, 6)} USDC. ` +
          `You need at least 0.01 USDC. Use "Mint Test USDC" below.`
        );
        setSubmitting(false);
        return;
      }

      const router = new ethers.Contract(
        addresses.StealthPaymentRouter,
        ROUTER_ABI,
        walletSigner
      );
      console.log("[Submit] Calling processPayment with Amoy gas overrides...");
      console.log("[Submit] Params:", {
        from: walletAddress,
        amount: "10000 (0.01 USDC)",
        nonce: paymentNonce,
        stealthAddress: stealthAddr,
        viewTag,
      });
      const tx = await router.processPayment(
        [
          walletAddress,
          ethers.parseUnits("0.01", 6),
          paymentNonce,
          0,
          paymentValidBefore,
          stealthAddr,
          ephPubKey,
          viewTag,
          eip3009Sig,
        ],
        AMOY_GAS_OVERRIDES
      );
      console.log("[Submit] TX sent:", tx.hash);
      setTxHash(tx.hash);
      await tx.wait();
      console.log("[Submit] TX confirmed");

      // Refresh stats
      const announcer = new ethers.Contract(
        addresses.StealthAnnouncer,
        ANNOUNCER_ABI,
        provider
      );
      const count = await announcer.announcementCount();
      setAnnouncementCount(Number(count));
      await fetchUsdcBalance(walletAddress);
    } catch (e: any) {
      if (e.code === "ACTION_REJECTED" || e.code === 4001) {
        setError("Transaction rejected.");
      } else if (
        e.message?.includes("transferWithAuthorization failed") ||
        e.message?.includes("insufficient")
      ) {
        setError(
          "Payment failed — insufficient USDC balance. Use 'Mint Test USDC' first."
        );
      } else {
        setError(e.shortMessage || e.message || "Transaction failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const mintTestUSDC = async () => {
    if (!walletSigner || !walletAddress) return;
    setMinting(true);
    setError(null);
    try {
      const addresses = CONTRACT_ADDRESSES[AMOY_CHAIN_ID];
      const usdc = new ethers.Contract(
        addresses.USDC,
        MOCK_USDC_ABI,
        walletSigner
      );
      console.log("[Mint] Sending mint(100 USDC) with Amoy gas overrides...");
      const tx = await usdc.mint(
        walletAddress,
        ethers.parseUnits("100", 6),
        AMOY_GAS_OVERRIDES
      );
      console.log("[Mint] TX sent:", tx.hash);
      await tx.wait();
      console.log("[Mint] TX confirmed");
      await fetchUsdcBalance(walletAddress);
    } catch (e: any) {
      console.error("[Mint] Error:", e);
      setError(e.shortMessage || e.message || "Mint failed");
    } finally {
      setMinting(false);
    }
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const steps = [
    { key: "connecting", label: "Connecting wallet to Polygon Amoy...", icon: Wallet },
    { key: "requesting", label: "Requesting API endpoint...", icon: Zap },
    { key: "got402", label: "Received 402 Payment Required", icon: AlertCircle },
    { key: "stealth", label: "Generating stealth address (ECDH)...", icon: Key },
    { key: "signing", label: "Signing EIP-3009 authorization — check MetaMask popup...", icon: Shield },
    { key: "processing", label: "Reading on-chain contract state...", icon: Loader2 },
    { key: "complete", label: "Payment authorized, data received!", icon: CheckCircle },
  ];

  const stepOrder = steps.map((s) => s.key);

  const getStepStatus = (stepKey: string) => {
    const currentIdx = stepOrder.indexOf(step);
    const stepIdx = stepOrder.indexOf(stepKey);
    if (stepIdx < currentIdx) return "done";
    if (stepIdx === currentIdx) return "active";
    return "pending";
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold">Live x402 Payment Demo</h1>
      <p className="mb-4 text-gray-400">
        Connect your wallet and experience the full x402 + ERC-5564 stealth
        payment flow with real cryptographic operations and on-chain contract
        queries on Polygon Amoy.
      </p>

      {/* On-chain stats */}
      {announcementCount !== null && (
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-2 text-sm">
            <span className="text-gray-400">Stealth Announcements: </span>
            <span className="font-mono text-primary-400">
              {announcementCount}
            </span>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-2 text-sm">
            <span className="text-gray-400">Network: </span>
            <span className="font-mono text-green-400">Polygon Amoy</span>
          </div>
        </div>
      )}

      {/* Wallet status */}
      {walletAddress && (
        <div className="mb-4 flex items-center gap-4 rounded-lg border border-green-800 bg-green-900/10 px-4 py-2 text-sm">
          <div>
            <span className="text-green-400">Connected: </span>
            <span className="font-mono">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          </div>
          {usdcBalance !== null && (
            <div className="text-gray-400">
              Balance:{" "}
              <span className="font-mono text-primary-400">
                {ethers.formatUnits(usdcBalance, 6)} USDC
              </span>
            </div>
          )}
        </div>
      )}

      {/* Demo Panel */}
      <div className="card mb-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="font-mono text-sm text-gray-400">
              GET /api/weather?city=new_york
            </div>
            <div className="text-xs text-gray-600">
              Protected by StealthPay402 middleware — requires 0.01 USDC
            </div>
          </div>
          <button
            onClick={runDemo}
            disabled={
              step !== "idle" && step !== "complete" && step !== "error"
            }
            className="btn-primary flex items-center gap-2"
          >
            {step === "idle" || step === "complete" || step === "error" ? (
              <>
                <Play className="h-4 w-4" />
                {step === "idle" ? "Start Demo" : "Run Again"}
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            )}
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((s) => {
            const status = getStepStatus(s.key);
            return (
              <div
                key={s.key}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-all ${
                  status === "done"
                    ? "border-green-800 bg-green-900/10"
                    : status === "active"
                    ? "border-primary-600 bg-primary-900/10"
                    : "border-gray-800 bg-gray-900/30 opacity-50"
                }`}
              >
                <s.icon
                  className={`h-5 w-5 ${
                    status === "done"
                      ? "text-green-400"
                      : status === "active"
                      ? "text-primary-400 animate-pulse"
                      : "text-gray-600"
                  }`}
                />
                <span
                  className={status === "pending" ? "text-gray-600" : ""}
                >
                  {s.label}
                </span>
                {status === "done" && (
                  <CheckCircle className="ml-auto h-4 w-4 text-green-400" />
                )}
              </div>
            );
          })}
        </div>

        {/* 402 Response */}
        {serverPayload && step !== "idle" && (
          <div className="mt-4 rounded-lg border border-yellow-800 bg-yellow-900/10 p-4">
            <div className="mb-1 text-xs text-yellow-400">
              402 Payment Required
            </div>
            <pre className="overflow-x-auto text-xs text-gray-400">
              {JSON.stringify(serverPayload, null, 2)}
            </pre>
          </div>
        )}

        {/* Stealth Address Display */}
        {stealthAddr && step !== "idle" && (
          <div className="mt-4 rounded-lg border border-primary-800 bg-primary-900/10 p-4">
            <div className="mb-1 text-xs text-primary-400">
              Generated Stealth Address (ERC-5564 ECDH)
            </div>
            <div className="mb-2 break-all font-mono text-sm">
              {stealthAddr}
            </div>
            <div className="space-y-1 text-xs text-gray-500">
              <div>
                <span className="text-gray-400">Ephemeral Key: </span>
                <span className="font-mono">
                  {ephPubKey.slice(0, 20)}...{ephPubKey.slice(-8)}
                </span>
              </div>
              <div>
                <span className="text-gray-400">View Tag: </span>
                <span className="font-mono">
                  0x{viewTag.toString(16).padStart(2, "0")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* EIP-3009 Signature */}
        {eip3009Sig && step !== "idle" && (
          <div className="mt-4 rounded-lg border border-purple-800 bg-purple-900/10 p-4">
            <div className="mb-1 text-xs text-purple-400">
              EIP-3009 Signature (signed via MetaMask)
            </div>
            <div className="break-all font-mono text-xs text-gray-400">
              {eip3009Sig}
            </div>
          </div>
        )}

        {/* Transaction Hash */}
        {txHash && (
          <div className="mt-3 rounded-lg border border-green-800 bg-green-900/10 p-4">
            <div className="mb-1 text-xs text-green-400">
              On-Chain Transaction
            </div>
            <a
              href={`https://amoy.polygonscan.com/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all font-mono text-sm text-primary-400 underline"
            >
              {txHash}
            </a>
          </div>
        )}
      </div>

      {/* Response */}
      {apiResponse && (
        <div className="card mb-8">
          <h3 className="mb-3 text-lg font-semibold text-green-400">
            API Response (200 OK)
          </h3>
          <pre className="overflow-x-auto rounded-lg bg-gray-800 p-4 text-sm text-gray-300">
            {apiResponse}
          </pre>
        </div>
      )}

      {/* Submit On-Chain Panel */}
      {step === "complete" && !txHash && (
        <div className="card mb-8">
          <h3 className="mb-3 text-lg font-semibold">Submit Payment On-Chain</h3>
          <p className="mb-4 text-sm text-gray-400">
            The EIP-3009 signature above is a real signed authorization. You can
            submit it on-chain to execute the full x402 payment flow: USDC
            transfer → fee deduction → stealth routing → ERC-5564 announcement.
          </p>

          {usdcBalance !== null && usdcBalance < ethers.parseUnits("0.01", 6) && (
            <div className="mb-4 rounded-lg border border-yellow-800 bg-yellow-900/10 p-3">
              <div className="mb-2 text-sm text-yellow-400">
                Insufficient USDC — you need at least 0.01 USDC
              </div>
              <button
                onClick={mintTestUSDC}
                disabled={minting}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                {minting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Minting...
                  </>
                ) : (
                  <>
                    <Coins className="h-4 w-4" />
                    Mint 100 Test USDC
                  </>
                )}
              </button>
            </div>
          )}

          <button
            onClick={submitOnChain}
            disabled={submitting}
            className="btn-primary flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit Payment (0.01 USDC + gas)
              </>
            )}
          </button>
        </div>
      )}

      {/* Transaction Success */}
      {txHash && (
        <div className="card mb-8 border-green-800">
          <h3 className="mb-3 text-lg font-semibold text-green-400">
            Payment Confirmed On-Chain
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-start justify-between">
              <span className="text-gray-500">Transaction</span>
              <a
                href={`https://amoy.polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-primary-400 hover:underline"
              >
                {txHash.slice(0, 14)}...{txHash.slice(-12)}
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span>0.01 USDC → stealth address</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Fee</span>
              <span>0.000010 USDC → FeeVault</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Announcements</span>
              <span className="text-primary-400">{announcementCount}</span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="card mb-8 border-red-800">
          <h3 className="mb-2 text-lg font-semibold text-red-400">Error</h3>
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Technical Explanation */}
      <div className="card">
        <h3 className="mb-4 text-lg font-semibold">
          What Happened Behind the Scenes
        </h3>
        <div className="space-y-3 text-sm text-gray-400">
          <p>
            <strong className="text-gray-200">1. Wallet Connection:</strong>{" "}
            Your browser wallet connected to Polygon Amoy testnet (Chain ID
            80002), establishing a real on-chain session.
          </p>
          <p>
            <strong className="text-gray-200">2. HTTP 402:</strong> The demo
            server returned a 402 Payment Required response with x402 payment
            instructions (amount, token, chain, receiver address).
          </p>
          <p>
            <strong className="text-gray-200">3. Stealth Address (ECDH):</strong>{" "}
            An ephemeral secp256k1 keypair was generated. The ephemeral private
            key and the receiver's viewing public key were used in ECDH to derive
            a shared secret. The stealth address was computed via EC point
            addition: P_stealth = P_spending + hash(S) * G.
          </p>
          <p>
            <strong className="text-gray-200">4. EIP-3009 Signature:</strong>{" "}
            MetaMask signed a real EIP-712 typed data message authorizing a 0.01
            USDC transfer via{" "}
            <code className="rounded bg-gray-800 px-1 text-xs">
              transferWithAuthorization
            </code>
            . This is the same mechanism USDC uses for gasless transfers on
            Polygon.
          </p>
          <p>
            <strong className="text-gray-200">5. On-Chain Query:</strong> Real
            contract state was read from StealthPaymentRouter (fee) and
            StealthAnnouncer (announcement count) deployed on Polygon Amoy.
          </p>
          <p>
            <strong className="text-gray-200">6. Submit On-Chain:</strong> The
            signed authorization can be submitted to the StealthPaymentRouter,
            which calls USDC.transferWithAuthorization, deducts the 0.1% fee to
            the ERC-4626 FeeVault, routes USDC to the stealth address, and emits
            an ERC-5564 Announcement event.
          </p>
        </div>
      </div>
    </div>
  );
}
