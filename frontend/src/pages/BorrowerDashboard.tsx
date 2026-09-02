import { useAccount } from "wagmi";
import { Link } from "react-router-dom";
import { useCreditScore } from "../hooks/useCreditScore";
import { useLoanVault } from "../hooks/useLoanVault";

export default function BorrowerDashboard() {
  const { address } = useAccount();
  const { score, creditLimit, availableCredit, isLoading, breakdown, refreshScore, refreshCooldown } = useCreditScore(address);
  const { activeLoan, loanHistory, repay } = useLoanVault(address);

  if (!address) {
    return (
      <div className="max-w-page mx-auto px-12" style={{ minHeight: "70vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="heading-lg text-bone-white mb-6">
          Unlock credit<br />without collateral.
        </h1>
        <p className="body-text text-silver-mist max-w-lg mb-10">
          Your onchain history is your creditworthiness. Connect your wallet to see your score and access USDC credit lines.
        </p>
        <div>
          <span className="accent-text nav-label text-xs">Get Started</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-page mx-auto px-12" style={{ minHeight: "50vh", display: "flex", alignItems: "center" }}>
        <p className="body-text text-ash-gray">Loading your profile...</p>
      </div>
    );
  }

  const scoreColor = score >= 800 ? "#15846e" : score >= 500 ? "#ffb829" : score >= 300 ? "#ffb829" : "#ff4444";
  const circumference = 2 * Math.PI * 90;
  const offset = circumference - (score / 1000) * circumference;

  return (
    <div className="max-w-page mx-auto px-12">
      <section className="flex gap-16 items-start" style={{ minHeight: "70vh" }}>
        {/* Left: Credit Profile Card */}
        <div className="flex-1 pt-8">
          <div className="card" style={{ maxWidth: "440px" }}>
            <p className="caption text-ash-gray uppercase mb-6">Your credit profile</p>

            <div className="flex items-center gap-6 mb-8">
              {/* Score Ring */}
              <div className="relative" style={{ width: "120px", height: "120px" }}>
                <svg width="120" height="120" viewBox="0 0 200 200" className="transform -rotate-90">
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
                  <span className="mono" style={{ fontSize: "32px", fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>
                    {score}
                  </span>
                  <span className="caption text-ash-gray">/1000</span>
                </div>
              </div>

              {/* Score + Badge */}
              <div>
                <span className="mono" style={{ fontSize: "42px", fontWeight: 600, color: "#fff", letterSpacing: "-0.02em" }}>
                  {score}
                </span>
                <div className="mt-2">
                  <span
                    className="inline-block px-3 py-1 text-xs font-semibold uppercase"
                    style={{
                      background: scoreColor + "18",
                      color: scoreColor,
                      borderRadius: "9999px",
                      letterSpacing: "0.025em",
                    }}
                  >
                    {score < 300 && "No access"}
                    {score >= 300 && score < 500 && "Starter"}
                    {score >= 500 && score < 650 && "Bronze"}
                    {score >= 650 && score < 800 && "Silver"}
                    {score >= 800 && score < 900 && "Gold"}
                    {score >= 900 && "Platinum"}
                  </span>
                </div>
              </div>
            </div>

            {/* Credit Limit / Available */}
            <div className="flex gap-6 mb-8">
              <div className="flex-1" style={{ padding: "16px", background: "#0f0f0f", borderRadius: "12px", border: "1px solid #1a1a1a" }}>
                <p className="caption text-ash-gray uppercase mb-1">Credit limit</p>
                <p className="mono" style={{ fontSize: "24px", fontWeight: 600, color: "#fff" }}>${creditLimit.toLocaleString()}</p>
                <p className="caption text-silver-mist">USDC available to borrow</p>
              </div>
              <div className="flex-1" style={{ padding: "16px", background: "#0f0f0f", borderRadius: "12px", border: "1px solid #1a1a1a" }}>
                <p className="caption text-ash-gray uppercase mb-1">Available credit</p>
                <p className="mono" style={{ fontSize: "24px", fontWeight: 600, color: "#15846e" }}>${availableCredit.toLocaleString()}</p>
                <p className="caption text-silver-mist">USDC remaining</p>
              </div>
            </div>

            {/* CTA */}
            <Link to={score >= 300 ? "/apply" : "/score"} className="btn-primary w-full" style={{ opacity: score < 300 ? 0.5 : 1, pointerEvents: score < 300 ? "none" : "auto" }}>
              {score < 300 && "Build score to borrow"}
              {score >= 300 && "Apply for loan"}
            </Link>
          </div>

          {/* Hint banner */}
          {score === 0 && (
            <div className="mt-4 px-5 py-3" style={{ background: "#0f0f0f", borderRadius: "12px", border: "1px solid #1a1a1a" }}>
              <p className="caption" style={{ color: "#7F77DD" }}>
                <span style={{ marginRight: "6px" }}>i</span>
                Try the score slider in the breakdown panel <span style={{ marginLeft: "4px" }}>→</span>
              </p>
            </div>
          )}
        </div>

        {/* Right: Score Breakdown Panel */}
        <div className="flex-1 pt-8">
          <div className="card" style={{ maxWidth: "440px" }}>
            <div className="flex items-center justify-between mb-6">
              <p className="body-text text-bone-white font-medium">Score breakdown</p>
              <button
                onClick={refreshScore}
                disabled={refreshCooldown > 0 || isLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase"
                style={{
                  background: "transparent",
                  border: "1px solid #1a1a1a",
                  color: "#bdbdbd",
                  borderRadius: "9999px",
                  cursor: refreshCooldown > 0 ? "not-allowed" : "pointer",
                  opacity: refreshCooldown > 0 ? 0.5 : 1,
                  letterSpacing: "0.025em",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56" />
                </svg>
                {refreshCooldown > 0 ? `${refreshCooldown}s` : "Refresh"}
              </button>
            </div>

            {/* Signal rows */}
            <div className="space-y-4">
              {([
                { label: "Simulate score", b: breakdown?.arcPassKyc, max: 1000, icon: "◉", color: "#7F77DD" },
                { label: "ArcPass KYC", b: breakdown?.arcPassKyc, max: 250, icon: "◻", color: "#8052ff" },
                { label: "Reputation", b: breakdown?.arcPassReputation, max: 200, icon: "★", color: "#ffb829" },
                { label: "Repayment history", b: breakdown?.repaymentHistory, max: 300, icon: "↻", color: "#15846e" },
                { label: "USDC throughput", b: breakdown?.usdcThroughput, max: 150, icon: "$", color: "#3b82f6" },
                { label: "Wallet age", b: breakdown?.walletAge, max: 100, icon: "◷", color: "#a855f7" },
              ] as const).map(({ label, b, max, icon, color }) => {
                const weighted = label === "Simulate score" ? score : (b?.weighted ?? 0);
                const maxVal = max;
                const pct = maxVal > 0 ? (weighted / maxVal) * 100 : 0;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <div className="signal-icon" style={{ background: color + "15" }}>
                      <span style={{ color, fontSize: "14px" }}>{icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="caption text-silver-mist">{label}</span>
                        <span className="mono caption" style={{ color: "#9a9a9a" }}>
                          {weighted} <span style={{ color: "#555" }}>/</span> {maxVal}
                        </span>
                      </div>
                      <div className="w-full h-1" style={{ background: "#1a1a1a", borderRadius: "2px" }}>
                        <div className="h-full" style={{ width: `${pct}%`, background: color, borderRadius: "2px", transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Active loan card */}
      {activeLoan && (
        <section className="py-12 border-t" style={{ borderColor: "#1a1a1a" }}>
          <span className="accent-text nav-label text-xs block mb-4">Active Loan</span>
          <div className="card" style={{ maxWidth: "640px" }}>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="caption text-ash-gray uppercase">Principal</p>
                <p className="mono body-text text-bone-white">${(Number(activeLoan.principal) / 1e6).toLocaleString()} USDC</p>
                <p className="caption text-silver-mist">Term {activeLoan.termDays}d / Due {new Date(activeLoan.dueTimestamp * 1000).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="caption text-ash-gray uppercase">Interest</p>
                <p className="mono body-text" style={{ color: "#ffb829" }}>${(Number(activeLoan.interest) / 1e6).toFixed(2)}</p>
                <p className="caption text-silver-mist">Status {activeLoan.status === 0 ? "ACTIVE" : activeLoan.status === 1 ? "REPAID" : "DEFAULTED"}</p>
              </div>
            </div>
            {activeLoan.status === 0 && (
              <button onClick={() => repay(activeLoan.loanId)} className="btn-primary" style={{ padding: "10px 20px" }}>
                Repay ${(Number(activeLoan.principal) / 1e6 + Number(activeLoan.interest) / 1e6).toFixed(2)}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Loan history */}
      {loanHistory.length > 0 && (
        <section className="py-12 border-t" style={{ borderColor: "#1a1a1a" }}>
          <span className="accent-text nav-label text-xs block mb-4">Loan History</span>
          <div className="overflow-x-auto" style={{ maxWidth: "640px" }}>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr className="text-ash-gray text-xs uppercase" style={{ borderBottom: "1px solid #1a1a1a" }}>
                  <th className="text-left py-3">ID</th>
                  <th className="text-left">Principal</th>
                  <th className="text-left">Term</th>
                  <th className="text-left">Status</th>
                  <th className="text-left">Due</th>
                </tr>
              </thead>
              <tbody>
                {loanHistory.slice(0, 10).map((l: any) => (
                  <tr key={l.loanId ?? l.id} style={{ borderBottom: "1px solid #0f0f0f" }}>
                    <td className="py-3 mono text-bone-white">#{l.loanId ?? l.id}</td>
                    <td className="mono text-silver-mist">${(Number(l.principal) / 1e6).toLocaleString()}</td>
                    <td className="text-silver-mist">{l.termDays}d</td>
                    <td>
                      <span className={`px-2 py-1 text-xs rounded ${l.status === "REPAID" || l.status === 1 ? "bg-green-500/20 text-green-400" : l.status === "DEFAULTED" || l.status === 2 ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-300"}`}>
                        {String(l.status)}
                      </span>
                    </td>
                    <td className="text-ash-gray">{l.dueAt ? new Date(l.dueAt).toLocaleDateString() : l.dueTimestamp ? new Date(l.dueTimestamp * 1000).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
