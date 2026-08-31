import { useAccount } from "wagmi";
import { useCreditScore } from "../hooks/useCreditScore";
import { CREDIT_TIERS } from "../lib/contracts";
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function CreditScore() {
  const { address } = useAccount();
  const { score, tier, breakdown, refreshScore, refreshCooldown, isLoading } = useCreditScore(address);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!address) return;
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    fetch(`${apiUrl}/api/v1/score/${address}/history`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setHistory(data.reverse().map((d: any) => ({
            score: d.score,
            date: new Date(d.snapshotAt).toLocaleDateString(),
          })));
        }
      })
      .catch(() => {});
  }, [address, score]);

  if (!address) {
    return (
      <div className="max-w-page mx-auto px-12" style={{ minHeight: "70vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="heading-lg text-bone-white mb-6">
          Your score,<br />your access.
        </h1>
        <p className="body-text text-silver-mist max-w-lg">
          Connect your wallet to view your credit score breakdown.
        </p>
      </div>
    );
  }

  const scoreColor = score >= 800 ? "#15846e" : score >= 500 ? "#ffb829" : score >= 300 ? "#ffb829" : "#ff4444";
  const circumference = 2 * Math.PI * 90;
  const offset = circumference - (score / 1000) * circumference;

  return (
    <div className="max-w-page mx-auto px-12">
      <section className="flex gap-24 items-start" style={{ minHeight: "80vh" }}>
        <div className="flex-1 pt-12">
          <span className="accent-text nav-label text-xs block mb-4">Score Breakdown</span>
          <h1 className="heading-lg text-bone-white mb-16">
            {score}
          </h1>

          <div className="space-y-8">
            {[
              { label: "ArcPass KYC", b: breakdown?.arcPassKyc, hint: "250pts KYC attestation (valid 365d)" },
              { label: "Reputation", b: breakdown?.arcPassReputation, hint: "200pts reputation (valid 30d)" },
              { label: "Repayment History", b: breakdown?.repaymentHistory, hint: "300pts protocol repayment" },
              { label: "USDC Throughput", b: breakdown?.usdcThroughput, hint: "150pts 90d volume" },
              { label: "Wallet Age", b: breakdown?.walletAge, hint: "100pts age on Arc" },
            ].map(({ label, b, hint }) => {
              const weighted = b?.weighted ?? 0;
              const max = b?.max ?? (label.includes("KYC")?250: label.includes("Rep")?200: label.includes("Repay")?300: label.includes("Through")?150:100);
              const pct = max>0 ? (weighted/max)*100 : 0;
              return (
                <div key={label} title={hint}>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="body-text text-silver-mist">{label}</span>
                    <span className="caption text-ash-gray">{weighted} / {max} pts</span>
                  </div>
                  <div className="w-full h-px" style={{ background: "#1a1a1a" }}>
                    <div className="h-full" style={{ width: `${pct}%`, background: "#8052ff", transition: "width 0.5s" }} />
                  </div>
                </div>
              );
            })}
            <button
              onClick={refreshScore}
              disabled={refreshCooldown>0 || isLoading}
              className="btn-primary mt-4"
              style={{ opacity: refreshCooldown>0?0.5:1, padding: "10px 20px", fontSize: "12px" }}
            >
              {refreshCooldown>0 ? `Refresh (${refreshCooldown}s)` : "Refresh Score"}
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center" style={{ minHeight: "500px" }}>
          <div className="relative">
            <svg width="240" height="240" viewBox="0 0 240 240" className="transform -rotate-90">
              <circle cx="120" cy="120" r="90" stroke="#1a1a1a" strokeWidth="3" fill="none" />
              <circle
                cx="120"
                cy="120"
                r="90"
                stroke={scoreColor}
                strokeWidth="3"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="display text-bone-white" style={{ fontSize: "48px", letterSpacing: "-1.68px" }}>
                {score}
              </span>
              <span className="caption text-ash-gray uppercase">{tier.label}</span>
            </div>
          </div>
        </div>
      </section>

      {history.length > 1 && (
        <section className="py-12">
          <span className="accent-text nav-label text-xs block mb-4">History (30 snapshots)</span>
          <div className="h-64 w-full max-w-2xl" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "8px", padding: "16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} axisLine={{ stroke: "#222" }} />
                <YAxis domain={[0, 1000]} tick={{ fill: "#666", fontSize: 10 }} axisLine={{ stroke: "#222" }} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", color: "#fff" }} />
                <Line type="monotone" dataKey="score" stroke="#8052ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="py-30">
        <span className="accent-text nav-label text-xs block mb-4">Credit Tiers</span>
        <h2 className="heading-sm text-bone-white mb-16">
          Score gates access.
        </h2>

        <div className="space-y-8 max-w-2xl">
          {CREDIT_TIERS.map((t) => (
            <div
              key={t.label}
              className="flex justify-between items-center pb-6"
              style={{
                borderBottom: score >= t.min && score <= t.max ? "1px solid #8052ff" : "1px solid #1a1a1a",
              }}
            >
              <div>
                <span className="body-text text-bone-white">{t.label}</span>
                <span className="caption text-ash-gray ml-3">
                  {t.min}–{t.max}
                </span>
              </div>
              <div className="text-right">
                <span className="body-text text-silver-mist">${t.limit}</span>
                {t.apr > 0 && (
                  <span className="caption text-ash-gray ml-3">{t.apr}% APR</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
