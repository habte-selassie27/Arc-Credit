import { prisma } from "../index";
import { publicClient, getOracleWalletClient, SCORE_ORACLE_ABI, CREDIT_SCORE_REGISTRY_ABI, CREDIT_LINE_ABI } from "../lib/arcClient";
import { getAttestations } from "./arcpassClient";

interface ScoreBreakdown {
  arcPassKyc: { raw: number; weighted: number; max: 250 };
  arcPassReputation: { raw: number; weighted: number; max: 200 };
  repaymentHistory: { raw: number; weighted: number; max: 300 };
  usdcThroughput: { raw: number; weighted: number; max: 150 };
  walletAge: { raw: number; weighted: number; max: 100 };
  total: number;
}

function getAddrs() {
  return {
    oracle: process.env.SCORE_ORACLE_ADDRESS as `0x${string}` | undefined,
    registry: process.env.CREDIT_SCORE_REGISTRY_ADDRESS as `0x${string}` | undefined,
    creditLine: process.env.CREDIT_LINE_ADDRESS as `0x${string}` | undefined,
  };
}
const SCORE_ORACLE_ADDRESS = process.env.SCORE_ORACLE_ADDRESS as `0x${string}` | undefined;
const CREDIT_SCORE_REGISTRY_ADDRESS = process.env.CREDIT_SCORE_REGISTRY_ADDRESS as `0x${string}` | undefined;

export async function computeScore(address: string): Promise<ScoreBreakdown> {
  // 1. Repayment history from DB (protocol)
  let repaidLoans: any[] = [];
  let totalRepaid = 0;
  let totalLoans = 0;
  try {
    repaidLoans = await prisma.loan.findMany({
      where: { borrower: address, status: "REPAID" },
    });
    totalRepaid = repaidLoans.reduce((sum, l) => sum + Number(l.principal), 0);
    const allLoans = await prisma.loan.findMany({ where: { borrower: address } });
    totalLoans = allLoans.length;
  } catch {
    // DB not available (e.g. DATABASE_URL placeholder) — keep 0
  }

  const repaymentRaw = Math.min(1000, Math.floor((totalRepaid / 100_000_000) * 1000));

  // 2. ArcPass attestations
  let kycRaw = 0;
  let kycVerified = false;
  let repRaw = 0;
  try {
    const att = await getAttestations(address);
    kycVerified = att.kyc.verified;
    kycRaw = kycVerified ? 1000 : 0;
    repRaw = att.reputation.score; // already 0 if stale per arcpassClient freshness
  } catch {
    // keep 0
  }

  // 3. USDC throughput (90d) — via on-chain balance + DB volume approximation
  // In production: query Arc RPC tx history; here approximate via totalRepaid + on-chain balance
  let usdcThroughputRaw = 0;
  let usdcWeighted = 0;
  try {
    // Try to read on-chain USDC balance as proxy for throughput
    // If totalRepaid already covers volume, use it
    const throughputUSDC = totalRepaid; // 6 decimals
    // Normalize: 10k USDC -> 1000 raw; linear cap
    usdcThroughputRaw = Math.min(1000, Math.floor((throughputUSDC / 10_000_000_000) * 1000)); // 10k USDC = 10e9 (6dec)
    usdcWeighted = Math.floor((usdcThroughputRaw * 150) / 1000);
  } catch {
    usdcWeighted = 0;
  }

  // 4. Wallet age — try on-chain via publicClient.getBalance creation? Use DB fallback: first score snapshot age
  let walletAgeDays = 0;
  let walletAgeRaw = 0;
  try {
    const firstSnapshot = await prisma.scoreSnapshot.findFirst({
      where: { address },
      orderBy: { snapshotAt: "asc" },
    }).catch(() => null);
    if (firstSnapshot) {
      const ageMs = Date.now() - new Date(firstSnapshot.snapshotAt).getTime();
      walletAgeDays = Math.floor(ageMs / 86400000);
    } else {
      // No history — treat as new wallet, 0-30 days approximation: 0 pts
      walletAgeDays = 0;
      // Try to infer from first loan tx timestamp if exists
      const firstLoan = await prisma.loan.findFirst({ where: { borrower: address }, orderBy: { createdAt: "asc" } }).catch(() => null);
      if (firstLoan) {
        const ageMs2 = Date.now() - new Date(firstLoan.createdAt).getTime();
        walletAgeDays = Math.floor(ageMs2 / 86400000);
      }
    }
    // Normalize: 365 days -> 1000 raw
    walletAgeRaw = Math.min(1000, Math.floor((walletAgeDays / 365) * 1000));
  } catch {
    walletAgeRaw = 0;
  }
  const walletAgeWeighted = Math.floor((walletAgeRaw * 100) / 1000);

  const kycWeighted = Math.floor((kycRaw * 250) / 1000);
  const repWeighted = Math.floor((repRaw * 200) / 1000);
  const repHistWeighted = Math.floor((repaymentRaw * 300) / 1000);
  // usdcWeighted already computed

  const breakdown: ScoreBreakdown = {
    arcPassKyc: { raw: kycRaw, weighted: kycWeighted, max: 250 },
    arcPassReputation: { raw: repRaw, weighted: repWeighted, max: 200 },
    repaymentHistory: { raw: repaymentRaw, weighted: repHistWeighted, max: 300 },
    usdcThroughput: { raw: usdcThroughputRaw, weighted: usdcWeighted, max: 150 },
    walletAge: { raw: walletAgeRaw, weighted: walletAgeWeighted, max: 100 },
    total: 0,
  };

  breakdown.total = Math.min(1000,
    breakdown.arcPassKyc.weighted +
    breakdown.arcPassReputation.weighted +
    breakdown.repaymentHistory.weighted +
    breakdown.usdcThroughput.weighted +
    breakdown.walletAge.weighted
  );

  // expose extra for oracle — all inputs to CreditMath.computeScore must be 0-1000 normalized
  (breakdown as any)._oracleArgs = {
    arcPassKycScore: kycRaw,
    arcPassRepScore: repRaw,
    repaymentRaw,
    usdcThroughput90d: usdcThroughputRaw, // normalized 0-1000, NOT raw USDC bigint
    walletAgeDays,
    arcPassVerified: kycVerified,
  };

  return breakdown;
}

export async function refreshAndStoreScore(address: string): Promise<ScoreBreakdown> {
  const breakdown = await computeScore(address);

  try {
    await prisma.scoreSnapshot.create({
      data: {
        address,
        score: breakdown.total,
        breakdown: JSON.parse(JSON.stringify(breakdown)),
      },
    });
  } catch {
    // DB not available — ignore
  }

  // Call on-chain ScoreOracle fulfill if configured
  const oracleArgs = (breakdown as any)._oracleArgs;
  const { oracle: SCORE_ORACLE_ADDRESS_LIVE, registry: CREDIT_SCORE_REGISTRY_ADDRESS_LIVE, creditLine: CREDIT_LINE_LIVE } = getAddrs();
  const SCORE_ORACLE_ADDR = SCORE_ORACLE_ADDRESS_LIVE || SCORE_ORACLE_ADDRESS;
  const REGISTRY_ADDR = CREDIT_SCORE_REGISTRY_ADDRESS_LIVE || CREDIT_SCORE_REGISTRY_ADDRESS;
  if (SCORE_ORACLE_ADDR && oracleArgs && process.env.ORACLE_SIGNER_PK) {
    try {
      const wallet = getOracleWalletClient();
      // Ensure profile exists
      try {
        const existing = await publicClient.readContract({
          address: REGISTRY_ADDR as `0x${string}`,
          abi: CREDIT_SCORE_REGISTRY_ABI,
          functionName: "getProfile",
          args: [address as `0x${string}`],
        }).catch(() => null);
        const lastUpdated = existing ? Number((existing as any)[1] ?? (existing as any).lastUpdated ?? 0) : 0;
        if (lastUpdated === 0) {
          await wallet.writeContract({
            address: SCORE_ORACLE_ADDR,
            abi: SCORE_ORACLE_ABI,
            functionName: "requestScoreUpdate",
            args: [address as `0x${string}`],
          }).catch(() => null);
        }
      } catch {}

      await wallet.writeContract({
        address: SCORE_ORACLE_ADDR,
        abi: SCORE_ORACLE_ABI,
        functionName: "fulfillScoreUpdate",
        args: [
          address as `0x${string}`,
          oracleArgs.arcPassKycScore as number,
          oracleArgs.arcPassRepScore as number,
          oracleArgs.repaymentRaw as number,
          oracleArgs.usdcThroughput90d as bigint,
          oracleArgs.walletAgeDays as number,
          oracleArgs.arcPassVerified as boolean,
        ],
      }).catch((e) => console.warn("oracle fulfill failed", e?.message?.slice(0,200)));

      // Refresh CreditLine to sync availableCredit with new limit
      if (CREDIT_LINE_LIVE) {
        await wallet.writeContract({
          address: CREDIT_LINE_LIVE,
          abi: CREDIT_LINE_ABI,
          functionName: "refreshCredit",
          args: [address as `0x${string}`],
        }).catch((e) => console.warn("refreshCredit failed", e?.message?.slice(0,150)));
      }
    } catch (e) {
      console.warn("oracle wallet failed", (e as any)?.message?.slice(0,200));
    }
  }

  // cleanup internal field before return
  delete (breakdown as any)._oracleArgs;
  return breakdown;
}

export async function getStoredScore(address: string): Promise<{ score: number; breakdown: any } | null> {
  try {
    const snap = await prisma.scoreSnapshot.findFirst({
      where: { address },
      orderBy: { snapshotAt: "desc" },
    });
    if (snap) return { score: snap.score, breakdown: snap.breakdown };
    // fallback to on-chain
    if (CREDIT_SCORE_REGISTRY_ADDRESS) {
      const onChain = await publicClient.readContract({
        address: CREDIT_SCORE_REGISTRY_ADDRESS,
        abi: CREDIT_SCORE_REGISTRY_ABI,
        functionName: "getScore",
        args: [address as `0x${string}`],
      }).catch(() => 0 as any);
      const score = Number(onChain ?? 0);
      if (score > 0) return { score, breakdown: null };
    }
    return null;
  } catch {
    return null;
  }
}
