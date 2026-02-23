import { Router } from "express";
import { stealthPayMiddleware } from "../middleware/stealthPay";

const router = Router();

// Shared config — reads from env or uses demo defaults
const sharedConfig = {
  routerAddress: process.env.ROUTER_ADDRESS,
  rpcUrl: process.env.RPC_URL,
  receiverMetaAddress: process.env.RECEIVER_META_ADDRESS,
};

// Protected weather endpoint (0.01 USDC)
router.get(
  "/weather",
  stealthPayMiddleware({
    price: "0.01",
    description: "Real-time weather data (powered by StealthPay402 x402)",
    ...sharedConfig,
  }),
  (_req, res) => {
    res.json({
      status: "success",
      data: {
        location: "New York, NY",
        temperature: 22.5,
        feels_like: 21.0,
        humidity: 65,
        wind_speed: 12.3,
        wind_direction: "NW",
        condition: "Partly Cloudy",
        pressure: 1013,
        visibility: 10,
        uv_index: 5,
        timestamp: new Date().toISOString(),
      },
      payment: {
        verified: (_req as any).payment?.verified || false,
        onChainVerified: (_req as any).payment?.onChainVerified || false,
        from: (_req as any).payment?.from || "unknown",
        stealth: !!(_req as any).payment?.stealthAddress,
      },
    });
  }
);

// Protected crypto prices endpoint (0.005 USDC)
router.get(
  "/prices",
  stealthPayMiddleware({
    price: "0.005",
    description: "Cryptocurrency price feeds (powered by StealthPay402 x402)",
    ...sharedConfig,
  }),
  (_req, res) => {
    res.json({
      status: "success",
      data: {
        POL: { price: 0.42, change_24h: 3.2 },
        ETH: { price: 3850.0, change_24h: -1.5 },
        BTC: { price: 98500.0, change_24h: 2.1 },
        USDC: { price: 1.0, change_24h: 0.0 },
      },
      timestamp: new Date().toISOString(),
      payment: {
        verified: (_req as any).payment?.verified || false,
        onChainVerified: (_req as any).payment?.onChainVerified || false,
        from: (_req as any).payment?.from || "unknown",
        stealth: !!(_req as any).payment?.stealthAddress,
      },
    });
  }
);

export default router;
