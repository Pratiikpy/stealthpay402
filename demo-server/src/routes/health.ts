import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    status: "healthy",
    service: "StealthPay402 Demo Server",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      "/health": "Public health check (free)",
      "/api/weather": "Weather data (0.01 USDC)",
      "/api/prices": "Crypto prices (0.005 USDC)",
    },
  });
});

export default router;
