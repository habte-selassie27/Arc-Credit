import { prisma } from "../index";
import {
  publicClient,
  LOAN_VAULT_ABI,
  CREDIT_LINE_ABI,
} from "../lib/arcClient";

const LOAN_VAULT_ADDRESS = process.env.LOAN_VAULT_ADDRESS as `0x${string}`;
const CREDIT_LINE_ADDRESS = process.env.CREDIT_LINE_ADDRESS as `0x${string}`;

export async function getLoanHistory(address: string) {
  try {
    return await prisma.loan.findMany({
      where: { borrower: address },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export async function getActiveLoan(address: string) {
  try {
    const loanId = await publicClient.readContract({
      address: LOAN_VAULT_ADDRESS,
      abi: LOAN_VAULT_ABI,
      functionName: "activeLoanId",
      args: [address as `0x${string}`],
    }).catch(() => 0n as bigint);

    if (loanId === 0n) return null;

    const loan: any = await publicClient.readContract({
      address: LOAN_VAULT_ADDRESS,
      abi: LOAN_VAULT_ABI,
      functionName: "getLoan",
      args: [loanId],
    }).catch(() => null);

    if (!loan) return null;
    return { loanId: Number(loanId), borrower: loan.borrower as string, principal: loan.principal?.toString() ?? "0", interest: loan.interest?.toString() ?? "0", dueTimestamp: Number(loan.dueTimestamp ?? 0), termDays: Number(loan.termDays ?? 0), status: Number(loan.status ?? 0) };
  } catch {
    return null;
  }
}

export async function validateLoanRequest(address: string, amount: bigint, termDays: number) {
  if (![7,14,30,90].includes(termDays)) throw new Error("invalid termDays");
  if (amount <= 0n) throw new Error("zero amount");

  // Check active loan
  const active = await getActiveLoan(address);
  if (active && active.status === 0) throw new Error("active loan exists — repay first");

  // Check credit limit
  if (CREDIT_LINE_ADDRESS) {
    const available = await publicClient.readContract({
      address: CREDIT_LINE_ADDRESS,
      abi: CREDIT_LINE_ABI,
      functionName: "getAvailableCredit",
      args: [address as `0x${string}`],
    }).catch(() => 0n as bigint);
    if (available < amount) throw new Error(`insufficient credit: available ${available.toString()} < ${amount.toString()}`);
    const rate = await publicClient.readContract({
      address: CREDIT_LINE_ADDRESS,
      abi: CREDIT_LINE_ABI,
      functionName: "getInterestRate",
      args: [address as `0x${string}`],
    }).catch(() => 0n as bigint);
    const interest = (amount * rate * BigInt(termDays)) / (365n * 10000n);
    return { available, rate, interest, totalDue: amount + interest };
  }
  return { available: 0n, rate: 0n, interest: 0n, totalDue: amount };
}

export async function applyLoan(
  address: string,
  amount: bigint,
  termDays: number
) {
  // Validate — do NOT sign on behalf of user. Frontend will sign requestLoan tx.
  const v = await validateLoanRequest(address, amount, termDays);

  // Record pending intent in DB for tracking (loanId unknown until on-chain)
  try {
    await prisma.loan.create({
      data: {
        loanId: Math.floor(Math.random() * 1_000_000_000), // placeholder, will be replaced by event indexer
        borrower: address,
        principal: amount,
        interest: v.interest,
        termDays,
        dueAt: new Date(Date.now() + termDays * 86400000),
        txHash: "pending-frontend-sign",
        status: "ACTIVE",
      },
    }).catch(() => null);
  } catch {}

  // Return tx params for frontend to sign (no private key needed)
  return {
    to: LOAN_VAULT_ADDRESS,
    functionName: "requestLoan",
    args: [amount.toString(), termDays],
    interest: v.interest.toString(),
    totalDue: v.totalDue.toString(),
    aprBps: v.rate.toString(),
    note: "sign with borrower wallet via wagmi writeContract",
  };
}

export async function buildRepayTx(loanId: number) {
  return {
    to: LOAN_VAULT_ADDRESS,
    functionName: "repay",
    args: [loanId],
  };
}

export async function markDefaulted(loanId: number) {
  try {
    const loan = await prisma.loan.findUnique({ where: { loanId } });
    if (!loan || loan.status !== "ACTIVE") return;
    await prisma.loan.update({
      where: { loanId },
      data: { status: "DEFAULTED" },
    });
  } catch {}
}
