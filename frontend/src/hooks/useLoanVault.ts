import { useWriteContract, useReadContract } from "wagmi";
import { useState, useEffect, useCallback } from "react";
import { CONTRACTS, USDC_DECIMALS } from "../lib/contracts";

const LOAN_VAULT_ABI = [
  { name: "requestLoan", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }, { name: "termDays", type: "uint8" }], outputs: [{ name: "loanId", type: "uint256" }] },
  { name: "repay", type: "function", stateMutability: "nonpayable", inputs: [{ name: "loanId", type: "uint256" }], outputs: [] },
  { name: "getLoan", type: "function", stateMutability: "view", inputs: [{ name: "loanId", type: "uint256" }], outputs: [{ type: "tuple", components: [{ name: "borrower", type: "address" }, { name: "principal", type: "uint256" }, { name: "interest", type: "uint256" }, { name: "dueTimestamp", type: "uint256" }, { name: "termDays", type: "uint8" }, { name: "status", type: "uint8" }] }] },
  { name: "activeLoanId", type: "function", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "totalDeposited", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "totalLent", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export interface Loan {
  loanId: number;
  borrower: string;
  principal: string;
  interest: string;
  dueTimestamp: number;
  termDays: number;
  status: number;
  txHash?: string;
}

export function useLoanVault(address?: `0x${string}`) {
  const { writeContractAsync } = useWriteContract();
  const [activeLoan, setActiveLoan] = useState<Loan | null>(null);
  const [loanHistory, setLoanHistory] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { data: activeId } = useReadContract({
    address: CONTRACTS.loanVault,
    abi: LOAN_VAULT_ABI,
    functionName: "activeLoanId",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const fetchLoans = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    try {
      const r = await fetch(`${apiUrl}/api/v1/loans/${address}`);
      const data = await r.json();
      if (data?.active) setActiveLoan(data.active);
      if (data?.history) setLoanHistory(data.history);
    } catch {}
    setIsLoading(false);
  }, [address]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans, activeId]);

  async function requestLoan(amount: number, termDays: number) {
    const amountBigInt = BigInt(Math.floor(amount * 10 ** USDC_DECIMALS));
    // Validate via backend first (credit check)
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    try {
      const v = await fetch(`${apiUrl}/api/v1/loans/${address}/validate?amount=${amountBigInt.toString()}&termDays=${termDays}`);
      const j = await v.json();
      if (!j.valid) throw new Error(j.error || "validation failed");
    } catch (e: any) {
      if (e.message?.includes("validation")) throw e;
    }
    const hash = await writeContractAsync({
      address: CONTRACTS.loanVault,
      abi: LOAN_VAULT_ABI,
      functionName: "requestLoan",
      args: [amountBigInt, termDays as 7 | 14 | 30 | 90],
    });
    // Notify backend (best-effort)
    try {
      await fetch(`${apiUrl}/api/v1/loans/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, amount: amountBigInt.toString(), termDays }),
      });
    } catch {}
    await fetchLoans();
    return hash;
  }

  async function repay(loanId: number) {
    const hash = await writeContractAsync({
      address: CONTRACTS.loanVault,
      abi: LOAN_VAULT_ABI,
      functionName: "repay",
      args: [BigInt(loanId)],
    });
    await fetchLoans();
    return hash;
  }

  return { activeLoan, loanHistory, isLoading, requestLoan, repay, refetch: fetchLoans };
}
