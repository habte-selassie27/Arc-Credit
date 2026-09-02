import { useAccount } from "wagmi";
import { useCreditScore } from "../hooks/useCreditScore";
import { CREDIT_TIERS } from "../lib/contracts";
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function CreditScore() {
  const { address } = useAccount();
  const { score, breakdown, refreshScore, refreshCooldown, isLoading } = useCreditScore(address);
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

  const tierColors: Record<string, string> = {
    "No Access": "#ff4444",
    "Starter": "#ffb829",
    "Bronze": "#ffb829",
    "Silver": "#bdbdbd",
    "Gold": "#ffb829",
    "Platinum": "#7F77DD",
  };

  return (
    <div className="max-w-page mx-auto px-12">
      <section className="flex gap-16 items-start" style={{ minHeight: "80vh" }}>
        {/* Left: Score Ring + Signals */}
        <div className="flex-1 pt-8">
          <div className="flex items-center gap-10 mb-12">
            {/* Large score ring */}
            <div className="relative" style={{ width: "180px", height: "180px" }}>
              <svg width="180" height="180" viewBox="0 0 200 200" className="transform -rotate-90">
                <circle cx="100" cy="100" r="90" stroke="#1a1a1a" strokeWidth="4" fill="none" />
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  stroke={scoreColor}
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  className="score-ring-animate"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="mono" style={{ fontSize: "48px", fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>
                  {score}
                </span>
                <span className="caption text-ash-gray">/1000</span>
              </div>
            </div>

            {/* Score label */}
            <div>
              <span className="caption text-ash-gray uppercase">Credit score</span>
            </div>
          </div>

          {/* Signal breakdown with icons */}
          <div className="space-y-4" style={{ maxWidth: "440px" }}>
            {([
              { label: "ArcPass KYC", b: breakdown?.arcPassKyc, max: 250, icon: "◻", color: "#534AB7", hint: "KYC attestation (valid 365d)" },
              { label: "Reputation", b: breakdown?.arcPassReputation, max: 200, icon: "★", color: "#ffb829", hint: "Reputation score (valid 30d)" },
              { label: "Repayment history", b: breakdown?.repaymentHistory, max: 300, icon: "↻", color: "#15846e", hint: "Protocol repayment track record" },
              { label: "USDC throughput", b: breakdown?.usdcThroughput, max: 150, icon: "$", color: "#3b82f6", hint: "90-day USDC volume" },
              { label: "Wallet age", b: breakdown?.walletAge, max: 100, icon: "◷", color: "#a855f7", hint: "Age of wallet on Arc" },
            ] as const).map(({ label, b, max, icon, color, hint }) => {
              const weighted = b?.weighted ?? 0;
              const pct = max > 0 ? (weighted / max) * 100 : 0;
              return (
                <div key={label} className="flex items-center gap-3" title={hint}>
                  <div className="signal-icon" style={{ background: color + "15" }}>
                    <span style={{ color, fontSize: "14px" }}>{icon}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="body-text text-silver-mist">{label}</span>
                      <span className="mono caption" style={{ color: "#9a9a9a" }}>
                        {weighted} <span style={{ color: "#555" }}>/</span> {max}
                      </span>
                    </div>
                    <div className="w-full h-1" style={{ background: "#1a1a1a", borderRadius: "2px" }}>
                      <div className="h-full" style={{ width: `${pct}%`, background: color, borderRadius: "2px", transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              onClick={refreshScore}
              disabled={refreshCooldown > 0 || isLoading}
              className="btn-primary mt-6"
              style={{ opacity: refreshCooldown > 0 ? 0.5 : 1, padding: "10px 20px", fontSize: "12px" }}
            >
              {refreshCooldown > 0 ? `Refresh (${refreshCooldown}s)` : "Refresh Score"}
            </button>
          </div>
        </div>

        {/* Right: Tier Table */}
        <div className="flex-1 pt-8">
          <p className="body-text text-bone-white font-medium mb-2">Score gates access</p>

          <div className="space-y-0 mt-8" style={{ maxWidth: "480px" }}>
            {CREDIT_TIERS.map((t) => {
              const isActive = score >= t.min && score <= t.max;
              const color = tierColors[t.label] || "#9a9a9a";
              return (
                <div
                  key={t.label}
                  className="tier-row"
                  style={{
                    borderBottomColor: isActive ? "#534AB7" : "#1a1a1a",
                    background: isActive ? "rgba(83, 75, 183, 0.08)" : "transparent",
                    padding: "14px 12px",
                    borderRadius: isActive ? "8px" : "0",
                  }}
                >
                  {/* Color dot */}
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: color,
                      flexShrink: 0,
                    }}
                  />

                  {/* Score range + label */}
                  <div>
                    <span className="mono caption" style={{ color: isActive ? "#fff" : "#9a9a9a", marginRight: "8px" }}>
                      {t.min}–{t.max}
                    </span>
                    <span className="body-text" style={{ color: isActive ? "#fff" : "#bdbdbd" }}>
                      {t.label}
                    </span>
                  </div>

                  {/* Limit */}
                  <span className="mono body-text" style={{ color: isActive ? "#fff" : "#9a9a9a" }}>
                    ${t.limit.toLocaleString()}
                  </span>

                  {/* APR badge */}
                  {t.apr > 0 ? (
                    <span
                      className="mono caption"
                      style={{
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        background: isActive ? "#534AB7" + "20" : "#1a1a1a",
                        color: isActive ? "#7F77DD" : "#9a9a9a",
                        border: `1px solid ${isActive ? "#534AB7" + "40" : "#222"}`,
                      }}
                    >
                      {t.apr}% APR
                    </span>
                  ) : (
                    <span className="mono caption" style={{ color: "#555" }}>—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* History chart */}
      {history.length > 1 && (
        <section className="py-12 border-t" style={{ borderColor: "#1a1a1a" }}>
          <span className="accent-text nav-label text-xs block mb-4">History (30 snapshots)</span>
          <div className="h-64 w-full max-w-2xl" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "12px", padding: "16px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} axisLine={{ stroke: "#222" }} />
                <YAxis domain={[0, 1000]} tick={{ fill: "#666", fontSize: 10 }} axisLine={{ stroke: "#222" }} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", color: "#fff" }} />
                <Line type="monotone" dataKey="score" stroke="#534AB7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}
