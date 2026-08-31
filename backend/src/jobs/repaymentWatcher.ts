import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "../index";
import { publicClient, getOracleWalletClient, REPAYMENT_SCHEDULER_ABI, LOAN_VAULT_ABI } from "../lib/arcClient";

const REDIS_URL = process.env.REDIS_URL || "";
const shouldUseRedis = REDIS_URL && !REDIS_URL.includes("...") && REDIS_URL !== "redis://...";

let connection: IORedis | undefined;
let repaymentQueue: Queue | undefined;
let repaymentWorker: Worker | undefined;

if (shouldUseRedis) {
  try {
    connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
    connection.on("error", (e) => console.warn("[repaymentWatcher] redis error", e.message?.slice(0,100)));

    repaymentQueue = new Queue("repayment-check", { connection });

    repaymentWorker = new Worker(
      "repayment-check",
      async (job) => {
        await checkAndMarkDefaults();
      },
      { connection }
    );

    repaymentQueue.add("check-defaults", {}, { repeat: { every: 600000 } }).catch(() => {});
  } catch (e) {
    console.warn("[repaymentWatcher] redis init failed, using in-memory fallback", (e as any)?.message);
  }
}

if (!shouldUseRedis) {
  // In-memory fallback every 10m (for local dev without redis)
  setInterval(() => checkAndMarkDefaults().catch(()=>{}), 600000);
  console.log("[repaymentWatcher] running in-memory mode (no REDIS_URL)");
}

export async function checkAndMarkDefaults() {
  let overdueLoans: any[] = [];
  try {
    overdueLoans = await prisma.loan.findMany({
      where: {
        status: "ACTIVE",
        dueAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
    });
  } catch {
    return; // DB not available
  }

  if (overdueLoans.length === 0) return;

  const schedulerAddr = process.env.REPAYMENT_SCHEDULER_ADDRESS as `0x${string}` | undefined;
  const hasOracleKey = !!process.env.ORACLE_SIGNER_PK;

  for (const loan of overdueLoans) {
    console.log(`[repaymentWatcher] marking loan ${loan.loanId} as defaulted`);
    // 1. Update DB
    try {
      await prisma.loan.update({
        where: { loanId: loan.loanId },
        data: { status: "DEFAULTED" },
      });
    } catch {}

    // 2. On-chain via RepaymentScheduler (which slashes score)
    if (schedulerAddr && hasOracleKey) {
      try {
        const wallet = getOracleWalletClient();
        // Optionally verify overdue on-chain before calling
        try {
          const loanOnChain: any = await publicClient.readContract({
            address: process.env.LOAN_VAULT_ADDRESS as `0x${string}`,
            abi: LOAN_VAULT_ABI,
            functionName: "getLoan",
            args: [BigInt(loan.loanId)],
          }).catch(() => null as any);
          if (loanOnChain && Number(loanOnChain.status) !== 0) continue; // not active
        } catch {}

        await wallet.writeContract({
          address: schedulerAddr,
          abi: REPAYMENT_SCHEDULER_ABI,
          functionName: "checkAndMarkDefault",
          args: [BigInt(loan.loanId)],
        });
        console.log(`[repaymentWatcher] on-chain defaulted ${loan.loanId}`);
      } catch (e) {
        console.warn(`[repaymentWatcher] on-chain fail ${loan.loanId}`, (e as any)?.message?.slice(0,200));
      }
    }
  }
}

export { repaymentQueue, repaymentWorker };
