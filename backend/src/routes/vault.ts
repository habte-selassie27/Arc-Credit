import { Router } from "express";
import { publicClient, LOAN_VAULT_ABI, TRANCHE_MANAGER_ABI } from "../lib/arcClient";

const router = Router();

function getVaultAddrs() {
  return {
    vault: process.env.LOAN_VAULT_ADDRESS as `0x${string}`,
    tranch: process.env.TRANCHE_MANAGER_ADDRESS as `0x${string}`,
  };
}

router.get("/stats", async (_req, res) => {
  try {
    const { vault: LOAN_VAULT_ADDRESS } = getVaultAddrs();
    if (!LOAN_VAULT_ADDRESS) throw new Error("LOAN_VAULT_ADDRESS not set");
    const [totalDeposited, totalLent] = await Promise.all([
      publicClient.readContract({
        address: LOAN_VAULT_ADDRESS,
        abi: LOAN_VAULT_ABI,
        functionName: "totalDeposited",
      }),
      publicClient.readContract({
        address: LOAN_VAULT_ADDRESS,
        abi: LOAN_VAULT_ABI,
        functionName: "totalLent",
      }),
    ]);

    const utilization =
      totalDeposited > 0n
        ? Number((totalLent * 10000n) / totalDeposited) / 100
        : 0;

    res.json({
      tvl: totalDeposited.toString(),
      totalLent: totalLent.toString(),
      utilization,
    });
  } catch (err: any) {
    console.error("[vault/stats] error", err?.message, err?.cause, err?.shortMessage);
    res.status(500).json({ error: "failed to fetch vault stats", detail: err?.message?.slice(0,200) });
  }
});

router.get("/position/:address", async (req, res) => {
  const { address } = req.params;
  try {
    const { tranch: TRANCHE_MANAGER_ADDRESS } = getVaultAddrs();
    if (!TRANCHE_MANAGER_ADDRESS) throw new Error("TRANCHE_MANAGER_ADDRESS not set");
    const [seniorShares, juniorShares] = await Promise.all([
      publicClient.readContract({
        address: TRANCHE_MANAGER_ADDRESS,
        abi: TRANCHE_MANAGER_ABI,
        functionName: "getShares",
        args: [address as `0x${string}`, 0],
      }),
      publicClient.readContract({
        address: TRANCHE_MANAGER_ADDRESS,
        abi: TRANCHE_MANAGER_ABI,
        functionName: "getShares",
        args: [address as `0x${string}`, 1],
      }),
    ]);

    res.json({
      seniorShares: seniorShares.toString(),
      juniorShares: juniorShares.toString(),
      claimableYield: "0",
    });
  } catch (err) {
    res.status(500).json({ error: "failed to fetch position" });
  }
});

export { router as vaultRoutes };
