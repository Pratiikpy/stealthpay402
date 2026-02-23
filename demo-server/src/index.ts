import express from "express";
import cors from "cors";
import healthRouter from "./routes/health";
import dataRouter from "./routes/data";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.get("/", (_req, res) => {
  res.json({
    name: "StealthPay402 Demo Server",
    description: "API endpoints protected by x402 stealth payment middleware",
    version: "1.0.0",
    sdk: "@stealthpay402/sdk",
    docs: "https://stealthpay402.vercel.app/docs",
    endpoints: {
      "GET /health": { cost: "Free", description: "Health check" },
      "GET /api/weather": { cost: "0.01 USDC", description: "Weather data" },
      "GET /api/prices": { cost: "0.005 USDC", description: "Crypto prices" },
    },
  });
});

app.use("/health", healthRouter);
app.use("/api", dataRouter);

// Start server
app.listen(PORT, () => {
  console.log(`\n  StealthPay402 Demo Server`);
  console.log(`  ========================`);
  console.log(`  SDK: @stealthpay402/sdk`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Health:  http://localhost:${PORT}/health`);
  console.log(`  Weather: http://localhost:${PORT}/api/weather (0.01 USDC)`);
  console.log(`  Prices:  http://localhost:${PORT}/api/prices  (0.005 USDC)\n`);
});

export default app;
