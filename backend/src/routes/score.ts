import { Router } from "express";
import { refreshAndStoreScore, computeScore, getStoredScore } from "../services/scoreAggregator";
import { publicClient, CREDIT_SCORE_REGISTRY_ABI } from "../lib/arcClient";

const router = Router();

// Simple in-memory cooldown (60s per address) for refresh
const lastRefresh = new Map<string, number>();

router.get("/:address", async (req, res) => {
  const { address } = req.params;
  try {
    // Return cached score without side-effect; fallback to on-chain if needed
    const cached = await getStoredScore(address);
    if (cached?.breakdown) {
      res.json(cached.breakdown);
      return;
    }
    if (cached) {
      // only on-chain score known
      const breakdown = await computeScore(address);
      // don't store on GET, just return live compute
      res.json({ ...breakdown, total: cached.score, _cachedOnChain: true });
      return;
    }
    // No cache — compute without oracle call
    const breakdown = await computeScore(address);
    // remove oracle internal field
    delete (breakdown as any)._oracleArgs;
    res.json(breakdown);
  } catch (err) {
    res.status(500).json({ error: "failed to fetch score" });
  }
});

router.post("/:address/refresh", async (req, res) => {
  const { address } = req.params;
  const now = Date.now();
  const last = lastRefresh.get(address.toLowerCase()) || 0;
  if (now - last < 60000) {
    res.status(429).json({ error: "cooldown 60s", retryAfterMs: 60000 - (now - last) });
    return;
  }
  lastRefresh.set(address.toLowerCase(), now);
  try {
    const breakdown = await refreshAndStoreScore(address);
    res.json({ score: breakdown.total, breakdown });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "failed to refresh score" });
  }
});

router.get("/:address/history", async (req, res) => {
  const { address } = req.params;
  try {
    const { prisma } = await import("../index");
    const snaps = await prisma.scoreSnapshot.findMany({
      where: { address },
      orderBy: { snapshotAt: "desc" },
      take: 30,
    }).catch(() => []);
    res.json(snaps);
  } catch {
    res.json([]);
  }
});

export { router as scoreRoutes };
