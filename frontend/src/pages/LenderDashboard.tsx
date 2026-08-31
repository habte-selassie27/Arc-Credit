import { useState, useEffect } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { CONTRACTS } from "../lib/contracts";
import { parseUnits } from "viem";

const USDC_ADDRESS = "0x1000000000000000000000000000000000000001" as `0x${string}`;
const TRANCHE_ABI = [
  { name: "deposit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "lender", type: "address" }, { name: "amount", type: "uint256" }, { name: "tranche", type: "uint8" }], outputs: [] },
  { name: "withdraw", type: "function", stateMutability: "nonpayable", inputs: [{ name: "lender", type: "address" }, { name: "amount", type: "uint256" }, { name: "tranche", type: "uint8" }], outputs: [] },
  { name: "getShares", type: "function", stateMutability: "view", inputs: [{ name: "lender", type: "address" }, { name: "tranche", type: "uint8" }], outputs: [{ type: "uint256" }] },
] as const;
const ERC20_ABI = [
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;
const VAULT_ABI = [
  { name: "claimYield", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

export default function LenderDashboard() {
  const { address } = useAccount();
  const [stats, setStats] = useState({ tvl: "0", totalLent: "0", utilization: 0 });
  const [position, setPosition] = useState({ seniorShares: "0", juniorShares: "0", claimableYield: "0" });
  const [activeTranche, setActiveTranche] = useState<0 | 1>(0);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const { writeContractAsync, isPending } = useWriteContract();

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";

  const refetch = () => {
    fetch(`${apiUrl}/api/v1/vault/stats`).then((r) => r.json()).then(setStats).catch(() => {});
    if (address) fetch(`${apiUrl}/api/v1/vault/position/${address}`).then((r) => r.json()).then(setPosition).catch(() => {});
  };

  useEffect(() => {
    refetch();
  }, [address]);

  async function handleDeposit() {
    if (!address || !depositAmount) return;
    const amt = parseUnits(depositAmount, 6);
    const min = activeTranche === 0 ? parseUnits("10", 6) : parseUnits("5", 6);
    if (amt < min) { setTxStatus(`Minimum ${activeTranche===0?"10":"5"} USDC`); return; }
    setTxStatus("Approving USDC...");
    try {
      await writeContractAsync({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve", args: [CONTRACTS.trancheManager, amt] });
      setTxStatus("Depositing...");
      await writeContractAsync({ address: CONTRACTS.trancheManager, abi: TRANCHE_ABI, functionName: "deposit", args: [address, amt, activeTranche] });
      setTxStatus("Deposited!");
      setDepositAmount("");
      setTimeout(refetch, 2000);
    } catch (e: any) {
      setTxStatus(e?.shortMessage || e?.message || "Deposit failed");
    }
  }

  async function handleWithdraw() {
    if (!address || !withdrawAmount) return;
    const amt = parseUnits(withdrawAmount, 6);
    setTxStatus("Withdrawing...");
    try {
      await writeContractAsync({ address: CONTRACTS.trancheManager, abi: TRANCHE_ABI, functionName: "withdraw", args: [address, amt, activeTranche] });
      setTxStatus("Withdrawn!");
      setWithdrawAmount("");
      setTimeout(refetch, 2000);
    } catch (e: any) {
      setTxStatus(e?.shortMessage || e?.message || "Withdraw failed");
    }
  }

  async function handleClaim() {
    setTxStatus("Claiming...");
    try {
      await writeContractAsync({ address: CONTRACTS.loanVault, abi: VAULT_ABI, functionName: "claimYield", args: [] });
      setTxStatus("Claimed!");
    } catch (e: any) {
      setTxStatus(e?.shortMessage || e?.message || "Claim failed");
    }
  }

  if (!address) {
    return (
      <div className="max-w-page mx-auto px-12" style={{ minHeight: "70vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="heading-lg text-bone-white mb-6">
          Earn yield<br />on USDC.
        </h1>
        <p className="body-text text-silver-mist max-w-lg">
          Deposit into risk-tranched pools and earn interest from borrower repayments.
        </p>
      </div>
    );
  }

  const tvlNum = Number(stats.tvl) / 1e6;
  const lentNum = Number(stats.totalLent) / 1e6;

  return (
    <div className="max-w-page mx-auto px-12">
      <section className="flex gap-24 items-start" style={{ minHeight: "70vh" }}>
        <div className="flex-1 pt-12">
          <span className="accent-text nav-label text-xs block mb-4">Vault Overview</span>
          <h1 className="heading-lg text-bone-white mb-16">
            Lending<br />pools.
          </h1>

          <div className="space-y-12 mb-20">
            <div>
              <p className="caption text-ash-gray uppercase mb-1">Total Value Locked</p>
              <p className="heading-sm text-bone-white">${tvlNum.toLocaleString()}</p>
            </div>
            <div>
              <p className="caption text-ash-gray uppercase mb-1">Total Lent</p>
              <p className="heading-sm text-bone-white">${lentNum.toLocaleString()}</p>
            </div>
            <div>
              <p className="caption text-ash-gray uppercase mb-1">Utilization</p>
              <p className="heading-sm text-saffron-spark">{stats.utilization.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="flex-1 pt-12">
          <span className="accent-text nav-label text-xs block mb-4">Your Position</span>

          <div className="space-y-12 mb-16">
            <div>
              <p className="caption text-ash-gray uppercase mb-1">Senior Shares</p>
              <p className="subheading text-bone-white">${(Number(position.seniorShares) / 1e6).toLocaleString()}</p>
              <p className="caption text-silver-mist">60% yield share, last-loss protection</p>
            </div>
            <div>
              <p className="caption text-ash-gray uppercase mb-1">Junior Shares</p>
              <p className="subheading text-bone-white">${(Number(position.juniorShares) / 1e6).toLocaleString()}</p>
              <p className="caption text-silver-mist">40% yield share, first-loss absorbed</p>
            </div>
            <div>
              <p className="caption text-ash-gray uppercase mb-1">Claimable Yield</p>
              <p className="subheading text-deep-verdant">${(Number(position.claimableYield) / 1e6).toFixed(2)}</p>
            </div>
          </div>

          <button onClick={handleClaim} disabled={isPending} className="btn-primary" style={{ opacity: isPending?0.5:1 }}>
            {isPending?"Pending...":"Claim Yield"}
          </button>
        </div>
      </section>

      <section className="py-30">
        <span className="accent-text nav-label text-xs block mb-4">Deposit</span>
        <h2 className="heading-sm text-bone-white mb-16">
          Choose your risk.
        </h2>

        <div className="flex gap-4 mb-12">
          <button
            onClick={() => setActiveTranche(0)}
            className="px-6 py-3 text-sm font-semibold uppercase"
            style={{
              background: activeTranche === 0 ? "#8052ff" : "transparent",
              color: activeTranche === 0 ? "#fff" : "#9a9a9a",
              borderRadius: "9999px",
              border: activeTranche === 0 ? "none" : "1px solid #222",
              letterSpacing: "0.025em",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Senior — 60% yield
          </button>
          <button
            onClick={() => setActiveTranche(1)}
            className="px-6 py-3 text-sm font-semibold uppercase"
            style={{
              background: activeTranche === 1 ? "#8052ff" : "transparent",
              color: activeTranche === 1 ? "#fff" : "#9a9a9a",
              borderRadius: "9999px",
              border: activeTranche === 1 ? "none" : "1px solid #222",
              letterSpacing: "0.025em",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            Junior — 40% yield
          </button>
        </div>

        <div className="max-w-md space-y-6">
          <div>
            <p className="caption text-ash-gray uppercase mb-2">Deposit — {activeTranche===0?"Senior (min 10 USDC)":"Junior (min 5 USDC)"}</p>
            <input
              type="number"
              placeholder="Amount USDC"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full bg-transparent text-bone-white body-text mb-3 pb-3"
              style={{
                borderBottom: "1px solid #1a1a1a",
                outline: "none",
              }}
            />
            <button onClick={handleDeposit} disabled={isPending || !depositAmount} className="btn-primary w-full" style={{ opacity: isPending?0.5:1 }}>
              {isPending?"Pending...":"Deposit"}
            </button>
          </div>
          <div>
            <p className="caption text-ash-gray uppercase mb-2">Withdraw — {activeTranche===0?"Senior":"Junior"} shares</p>
            <input
              type="number"
              placeholder="Shares USDC"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full bg-transparent text-bone-white body-text mb-3 pb-3"
              style={{
                borderBottom: "1px solid #1a1a1a",
                outline: "none",
              }}
            />
            <button onClick={handleWithdraw} disabled={isPending || !withdrawAmount} className="btn-primary w-full" style={{ opacity: isPending?0.5:1, background: "transparent", border: "1px solid #8052ff", color: "#8052ff" }}>
              {isPending?"Pending...":"Withdraw"}
            </button>
          </div>
          {txStatus && <p className="text-sm" style={{ color: txStatus.includes("fail")||txStatus.includes("Minimum") ? "#ff8888" : "#88ff88" }}>{txStatus}</p>}
          <p className="caption text-ash-gray">USDC is gas on Arc — you pay gas in USDC. TrancheManager holds yield 60/40; withdraw reduces shares pro-rata.</p>
        </div>
      </section>

      <section className="py-12 border-t" style={{ borderColor: "#1a1a1a" }}>
        <span className="accent-text nav-label text-xs block mb-4">Risk</span>
        <div className="grid grid-cols-3 gap-8 max-w-3xl">
          <div><p className="caption text-ash-gray uppercase">Senior Yield</p><p className="body-text text-bone-white">60% pool</p><p className="caption text-silver-mist">last-loss</p></div>
          <div><p className="caption text-ash-gray uppercase">Junior Yield</p><p className="body-text text-bone-white">40% pool</p><p className="caption text-silver-mist">first-loss</p></div>
          <div><p className="caption text-ash-gray uppercase">Default Penalty</p><p className="body-text text-bone-white">-150/300/500 pts</p><p className="caption text-silver-mist">by loan size</p></div>
        </div>
      </section>
    </div>
  );
}
