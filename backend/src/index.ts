import "dotenv/config";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
// Also load root .env if present (backend/.env already loaded via dotenv/config)
const rootEnv = path.resolve(process.cwd(), "../.env");
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv, override: true });
console.log(`[env] LOAN_VAULT_ADDRESS=${process.env.LOAN_VAULT_ADDRESS?.slice(0,10) || "NOT SET"} ARC_RPC=${process.env.ARC_RPC_URL?.slice(0,25) || "NOT SET"} TRNCH=${process.env.TRANCHE_MANAGER_ADDRESS?.slice(0,10) || "NOT SET"}`);

import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { scoreRoutes } from "./routes/score";
import { loanRoutes } from "./routes/loan";
import { authRoutes } from "./routes/auth";
import { vaultRoutes } from "./routes/vault";
import { arcpassRoutes } from "./routes/arcpass";

const app = express();
const PORT = process.env.PORT || 3000;

let prisma: PrismaClient;
try {
  prisma = new PrismaClient();
  // Don't crash if DB URL is placeholder
  prisma.$connect().catch(() => console.warn("[prisma] DB connect failed — running in mock mode (set DATABASE_URL)"));
} catch (e) {
  console.warn("[prisma] init failed", (e as any)?.message);
  // Fallback mock that satisfies prisma.loan/scoreSnapshot calls
  prisma = new Proxy({} as any, {
    get: () => new Proxy({} as any, {
      get: () => async () => { throw new Error("DB not configured"); }
    })
  });
}
export { prisma };

// Start repayment watcher (in-memory fallback if REDIS_URL not set)
import("./jobs/repaymentWatcher").catch(() => console.warn("[watcher] failed to start"));

app.use(cors());
app.use(express.json());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/score", scoreRoutes);
app.use("/api/v1/loans", loanRoutes);
app.use("/api/v1/vault", vaultRoutes);
app.use("/api/v1/arcpass", arcpassRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`ArcCredit backend running on port ${PORT}`);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
