import { useReadContract } from "wagmi";
import { useState, useEffect } from "react";
import { CONTRACTS, USDC_DECIMALS, getTier } from "../lib/contracts";

const SCORE_ABI = [
  { name: "getScore", type: "function", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint16" }] },
  { name: "getProfile", type: "function", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "tuple", components: [{ name: "score", type: "uint16" }, { name: "lastUpdated", type: "uint32" }, { name: "totalLoans", type: "uint32" }, { name: "repaidLoans", type: "uint32" }, { name: "defaultedLoans", type: "uint32" }, { name: "totalVolumeUSDC", type: "uint96" }, { name: "arcPassVerified", type: "bool" }] }] },
] as const;

const CREDIT_LINE_ABI = [
  { name: "getCreditLimit", type: "function", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "getAvailableCredit", type: "function", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "getInterestRate", type: "function", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

interface ScoreBreakdown {
  arcPassKyc: { raw: number; weighted: number; max: number };
  arcPassReputation: { raw: number; weighted: number; max: number };
  repaymentHistory: { raw: number; weighted: number; max: number };
  usdcThroughput: { raw: number; weighted: number; max: number };
  walletAge: { raw: number; weighted: number; max: number };
  total: number;
}

export function useCreditScore(address?: `0x${string}`) {
  const { data: score, isLoading: scoreLoading, refetch: refetchScore } = useReadContract({
    address: CONTRACTS.creditScoreRegistry,
    abi: SCORE_ABI,
    functionName: "getScore",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: profile } = useReadContract({
    address: CONTRACTS.creditScoreRegistry,
    abi: SCORE_ABI,
    functionName: "getProfile",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: creditLimit, isLoading: limitLoading } = useReadContract({
    address: CONTRACTS.creditLine,
    abi: CREDIT_LINE_ABI,
    functionName: "getCreditLimit",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: availableCredit, isLoading: availLoading } = useReadContract({
    address: CONTRACTS.creditLine,
    abi: CREDIT_LINE_ABI,
    functionName: "getAvailableCredit",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: interestRate } = useReadContract({
    address: CONTRACTS.creditLine,
    abi: CREDIT_LINE_ABI,
    functionName: "getInterestRate",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const [breakdown, setBreakdown] = useState<ScoreBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(0);

  const scoreNum = score ? Number(score) : 0;
  const tier = getTier(scoreNum);

  useEffect(() => {
    if (!address) return;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    setBreakdownLoading(true);
    fetch(`${apiUrl}/api/v1/score/${address}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.total === "number") setBreakdown(data);
        else if (data?.breakdown) setBreakdown(data.breakdown);
        setBreakdownLoading(false);
      })
      .catch(() => setBreakdownLoading(false));
  }, [address, scoreNum]);

  async function refreshScore() {
    if (!address) return;
    if (refreshCooldown > 0) return;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    setRefreshCooldown(60);
    const id = setInterval(() => setRefreshCooldown((c) => (c <= 1 ? (clearInterval(id), 0) : c - 1)), 1000);
    try {
      const r = await fetch(`${apiUrl}/api/v1/score/${address}/refresh`, { method: "POST" });
      const data = await r.json();
      if (data?.breakdown) setBreakdown(data.breakdown);
      await refetchScore();
    } catch {}
  }

  return {
    score: scoreNum,
    tier,
    creditLimit: creditLimit ? Number(creditLimit) / 10 ** USDC_DECIMALS : 0,
    availableCredit: availableCredit ? Number(availableCredit) / 10 ** USDC_DECIMALS : 0,
    interestRateBps: interestRate ? Number(interestRate) : tier ? tier.apr * 100 : 0,
    breakdown,
    profile: profile as any,
    isLoading: scoreLoading || limitLoading || availLoading || breakdownLoading,
    refreshScore,
    refreshCooldown,
  };
}
