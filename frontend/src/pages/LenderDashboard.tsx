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
    if (amt < min) { setTxStatus(`Minimum ${activeTranche === 0 ? "10" : "5"} USDC`); return; }
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
      {/* Hero */}
      <section className="pt-12 pb-20">
        <p className="caption text-ash-gray uppercase mb-3">Lending pools.</p>
        <p className="body-text text-silver-mist max-w-lg mb-12">
          Earn yield by funding undercollateralized credit lines. Choose your risk level.
        </p>

        {/* Stats row */}
        <div className="flex gap-16 mb-16">
          <div>
            <p className="caption text-ash-gray uppercase mb-1">Total value locked</p>
            <p className="mono" style={{ fontSize: "32px", fontWeight: 600, color: "#fff" }}>${tvlNum.toLocaleString()}</p>
            {tvlNum === 0 && <p className="caption" style={{ color: "#7F77DD" }}>Launching soon</p>}
          </div>
          <div>
            <p className="caption text-ash-gray uppercase mb-1">Total lent</p>
            <p className="mono" style={{ fontSize: "32px", fontWeight: 600, color: "#fff" }}>${lentNum.toLocaleString()}</p>
          </div>
          <div>
            <p className="caption text-ash-gray uppercase mb-1">Utilization</p>
            <p className="mono" style={{ fontSize: "32px", fontWeight: 600, color: "#fff" }}>{stats.utilization.toFixed(1)}%</p>
          </div>
        </div>

        {/* Tranche cards */}
        <div className="flex gap-6">
          {/* Senior */}
          <div
            className="flex-1 cursor-pointer"
            onClick={() => setActiveTranche(0)}
            style={{
              padding: "28px",
              background: activeTranche === 0 ? "#0f0f0f" : "#0a0a0a",
              border: `1px solid ${activeTranche === 0 ? "#534AB7" : "#1a1a1a"}`,
              borderRadius: "16px",
              transition: "border-color 0.2s",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <span className="badge-senior">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Senior — protected
              </span>
            </div>
            <h3 className="body-text text-bone-white font-medium mb-2">Lower risk, stable yield</h3>
            <p className="caption text-silver-mist mb-6">
              Last to absorb losses. Your deposit is backed by the junior tranche first. Suited for capital-preservation strategies.
            </p>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="mono" style={{ fontSize: "32px", fontWeight: 600, color: "#fff" }}>60%</span>
              <span className="caption text-ash-gray">of pool yield</span>
            </div>
            <p className="caption text-ash-gray">Min deposit: 10 USDC</p>
          </div>

          {/* Junior */}
          <div
            className="flex-1 cursor-pointer"
            onClick={() => setActiveTranche(1)}
            style={{
              padding: "28px",
              background: activeTranche === 1 ? "#0f0f0f" : "#0a0a0a",
              border: `1px solid ${activeTranche === 1 ? "#ffb829" : "#1a1a1a"}`,
              borderRadius: "16px",
              transition: "border-color 0.2s",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <span className="badge-junior">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2c1 3 2.5 3.5 3.5 4.5A5 5 0 0117 10a5 5 0 01-10 0c0-1.5.5-2 1-3" />
                </svg>
                Junior — higher yield
              </span>
            </div>
            <h3 className="body-text text-bone-white font-medium mb-2">First-loss, higher reward</h3>
            <p className="caption text-silver-mist mb-6">
              Absorbs defaults first in exchange for a larger share of interest. Best for yield-maximizing strategies with higher risk tolerance.
            </p>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="mono" style={{ fontSize: "32px", fontWeight: 600, color: "#fff" }}>40%</span>
              <span className="caption text-ash-gray">of pool yield</span>
            </div>
            <p className="caption text-ash-gray">Min deposit: 5 USDC</p>
          </div>
        </div>
      </section>

      {/* Deposit / Withdraw */}
      <section className="py-12 border-t" style={{ borderColor: "#1a1a1a" }}>
        <p className="body-text text-bone-white font-medium mb-1">
          Deposit USDC — {activeTranche === 0 ? "Senior tranche" : "Junior tranche"}
        </p>

        <div className="max-w-md mt-8 space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="number"
                placeholder="Amount in USDC"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="flex-1 bg-transparent text-bone-white mono"
                style={{
                  fontSize: "18px",
                  padding: "12px 0",
                  borderBottom: "1px solid #1a1a1a",
                  outline: "none",
                }}
              />
              <button onClick={handleDeposit} disabled={isPending || !depositAmount} className="btn-primary" style={{ opacity: isPending ? 0.5 : 1, padding: "10px 24px" }}>
                {isPending ? "..." : "Deposit"}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="number"
                placeholder="Shares to withdraw"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="flex-1 bg-transparent text-bone-white mono"
                style={{
                  fontSize: "18px",
                  padding: "12px 0",
                  borderBottom: "1px solid #1a1a1a",
                  outline: "none",
                }}
              />
              <button
                onClick={handleWithdraw}
                disabled={isPending || !withdrawAmount}
                className="btn-primary"
                style={{
                  opacity: isPending ? 0.5 : 1,
                  padding: "10px 24px",
                  background: "transparent",
                  border: "1px solid #534AB7",
                  color: "#7F77DD",
                }}
              >
                {isPending ? "..." : "Withdraw"}
              </button>
            </div>
          </div>

          {txStatus && (
            <p className="caption" style={{ color: txStatus.includes("fail") || txStatus.includes("Minimum") ? "#ff8888" : "#88ff88" }}>
              {txStatus}
            </p>
          )}
        </div>

        {/* Position */}
        <div className="flex gap-16 mt-12">
          <div>
            <p className="caption text-ash-gray uppercase mb-1">Senior Shares</p>
            <p className="mono subheading text-bone-white">${(Number(position.seniorShares) / 1e6).toLocaleString()}</p>
            <p className="caption text-silver-mist">60% yield share, last-loss protection</p>
          </div>
          <div>
            <p className="caption text-ash-gray uppercase mb-1">Junior Shares</p>
            <p className="mono subheading text-bone-white">${(Number(position.juniorShares) / 1e6).toLocaleString()}</p>
            <p className="caption text-silver-mist">40% yield share, first-loss absorbed</p>
          </div>
          <div>
            <p className="caption text-ash-gray uppercase mb-1">Claimable Yield</p>
            <p className="mono subheading" style={{ color: "#15846e" }}>${(Number(position.claimableYield) / 1e6).toFixed(2)}</p>
            <button onClick={handleClaim} disabled={isPending} className="btn-primary mt-4" style={{ padding: "10px 20px", fontSize: "12px" }}>
              {isPending ? "Pending..." : "Claim Yield"}
            </button>
          </div>
        </div>
      </section>

      {/* Risk */}
      <section className="py-12 border-t" style={{ borderColor: "#1a1a1a" }}>
        <span className="accent-text nav-label text-xs block mb-4">Risk</span>
        <div className="grid grid-cols-3 gap-8 max-w-3xl">
          <div style={{ padding: "16px", background: "#0a0a0a", borderRadius: "12px", border: "1px solid #1a1a1a" }}>
            <p className="caption text-ash-gray uppercase">Senior Yield</p>
            <p className="body-text text-bone-white">60% pool</p>
            <p className="caption text-silver-mist">last-loss</p>
          </div>
          <div style={{ padding: "16px", background: "#0a0a0a", borderRadius: "12px", border: "1px solid #1a1a1a" }}>
            <p className="caption text-ash-gray uppercase">Junior Yield</p>
            <p className="body-text text-bone-white">40% pool</p>
            <p className="caption text-silver-mist">first-loss</p>
          </div>
          <div style={{ padding: "16px", background: "#0a0a0a", borderRadius: "12px", border: "1px solid #1a1a1a" }}>
            <p className="caption text-ash-gray uppercase">Default Penalty</p>
            <p className="mono body-text text-bone-white">-150/300/500 pts</p>
            <p className="caption text-silver-mist">by loan size</p>
          </div>
        </div>
      </section>
    </div>
  );
}
