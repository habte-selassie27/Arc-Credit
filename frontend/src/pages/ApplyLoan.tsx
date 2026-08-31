import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useCreditScore } from "../hooks/useCreditScore";
import { useLoanVault } from "../hooks/useLoanVault";
import { useArcPass } from "../hooks/useArcPass";

const TERMS = [7, 14, 30, 90];

export default function ApplyLoan() {
  const { address } = useAccount();
  const { creditLimit, availableCredit, tier, score } = useCreditScore(address);
  const { requestLoan } = useLoanVault(address);
  const { kycVerified, reputationScore } = useArcPass(address);
  const navigate = useNavigate();

  const [amount, setAmount] = useState(0);
  const [termDays, setTermDays] = useState<7|14|30|90>(14);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string|null>(null);

  const maxAmount = availableCredit;
  const estimatedInterest = amount * (tier.apr / 100) * (termDays / 365);
  const totalDue = amount + estimatedInterest;
  const noAccess = score < 300;

  async function handleSubmit() {
    if (!address || amount <= 0) return;
    if (noAccess) { setError("Score below 300 — no credit access. Build history first."); return; }
    setIsSubmitting(true);
    setError(null);
    try {
      await requestLoan(amount, termDays);
      navigate("/");
    } catch (err: any) {
      console.error(err);
      setError(err?.shortMessage || err?.message || "Loan request failed (check credit + approvals)");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!address) {
    return (
      <div className="max-w-page mx-auto px-12" style={{ minHeight: "70vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="heading-lg text-bone-white mb-6">
          Connect your<br />wallet.
        </h1>
        <p className="body-text text-silver-mist max-w-lg">
          Connect your wallet to apply for a credit line.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-page mx-auto px-12">
      <section className="flex gap-24 items-start" style={{ minHeight: "70vh" }}>
        <div className="flex-1 pt-12">
          <span className="accent-text nav-label text-xs block mb-4">Request Credit</span>
          <h1 className="heading-lg text-bone-white mb-12">
            Borrow<br />USDC.
          </h1>

          <div className="mb-12">
            <p className="caption text-ash-gray uppercase mb-3">Loan Amount</p>
            <p className="heading-sm text-bone-white mb-4">${amount.toLocaleString()}</p>
            <input
              type="range"
              min={0}
              max={maxAmount}
              step={10}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full max-w-md"
              style={{
                accentColor: "#8052ff",
                height: "2px",
              }}
            />
            <p className="caption text-silver-mist mt-2">
              Max available: ${maxAmount.toLocaleString()} USDC
            </p>
          </div>

          <div className="mb-8 flex gap-2">
            <span className={`px-3 py-1 text-xs rounded-full border ${kycVerified?"bg-green-500/10 text-green-400 border-green-500/20":"bg-red-500/10 text-red-400 border-red-500/20"}`}>KYC {kycVerified?"✓":"✗"}</span>
            <span className={`px-3 py-1 text-xs rounded-full border ${reputationScore>0?"bg-green-500/10 text-green-400 border-green-500/20":"bg-yellow-500/10 text-yellow-400 border-yellow-500/20"}`}>Reputation {reputationScore}</span>
          </div>
          {noAccess && (
            <div className="mb-8 p-3 rounded text-sm" style={{ background: "#ff444410", border: "1px solid #ff444430", color: "#ff8888" }}>
              Score {score} &lt; 300 — no credit line. Repay loans + verify ArcPass to unlock.
            </div>
          )}

          <div className="mb-12">
            <p className="caption text-ash-gray uppercase mb-3">Term</p>
            <div className="flex gap-3">
              {TERMS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTermDays(t as any)}
                  className="px-5 py-2 text-sm font-semibold uppercase"
                  style={{
                    background: termDays === t ? "#8052ff" : "transparent",
                    color: termDays === t ? "#fff" : "#9a9a9a",
                    borderRadius: "9999px",
                    border: termDays === t ? "none" : "1px solid #222",
                    letterSpacing: "0.025em",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {t}d
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 max-w-md mb-16">
            <div className="flex justify-between">
              <span className="body-text text-ash-gray">APR</span>
              <span className="body-text text-bone-white">{tier.apr}%</span>
            </div>
            <div className="flex justify-between">
              <span className="body-text text-ash-gray">Estimated Interest</span>
              <span className="body-text text-bone-white">${estimatedInterest.toFixed(2)}</span>
            </div>
            <div
              className="flex justify-between pt-4"
              style={{ borderTop: "1px solid #1a1a1a" }}
            >
              <span className="body-text text-bone-white font-semibold">Total Due</span>
              <span className="body-text text-bone-white font-semibold">${totalDue.toFixed(2)}</span>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm mb-4 max-w-md">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={amount <= 0 || isSubmitting || noAccess}
            className="btn-primary"
            style={{ opacity: (amount <=0 || noAccess)?0.4:1 }}
          >
            {isSubmitting ? "Submitting..." : "Request Loan"}
          </button>
          <p className="caption text-ash-gray mt-3 max-w-md">USDC is gas on Arc — ensure you have USDC for gas + loan will be disbursed instantly (sub-second finality).</p>
        </div>

        <div className="flex-1 flex flex-col justify-center" style={{ minHeight: "500px" }}>
          <div className="space-y-6">
            <div>
              <p className="caption text-ash-gray uppercase">Your Tier</p>
              <p className="subheading text-bone-white">{tier.label}</p>
            </div>
            <div>
              <p className="caption text-ash-gray uppercase">Credit Limit</p>
              <p className="subheading text-bone-white">${creditLimit.toLocaleString()}</p>
            </div>
            <div>
              <p className="caption text-ash-gray uppercase">Interest Rate</p>
              <p className="subheading text-saffron-spark">{tier.apr}% APR</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
