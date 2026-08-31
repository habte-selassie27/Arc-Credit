import { useAccount } from "wagmi";
import { Link } from "react-router-dom";
import { useCreditScore } from "../hooks/useCreditScore";
import { useLoanVault } from "../hooks/useLoanVault";
import { useArcPass } from "../hooks/useArcPass";

export default function BorrowerDashboard() {
  const { address } = useAccount();
  const { score, tier, creditLimit, availableCredit, isLoading, breakdown } = useCreditScore(address);
  const { activeLoan, loanHistory, repay } = useLoanVault(address);
  const { kycVerified, reputationScore } = useArcPass(address);

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

  return (
    <div className="max-w-page mx-auto px-12">
      <section className="flex gap-24 items-start" style={{ minHeight: "70vh" }}>
        <div className="flex-1 pt-12">
          <span className="accent-text nav-label text-xs block mb-4">Your Credit Profile</span>

          <h1 className="heading-lg text-bone-white mb-8">
            {score}
          </h1>
          <p className="caption text-ash-gray uppercase mb-2">Credit Score / 1000</p>

          <div className="mb-12">
            <span
              className="inline-block px-4 py-1 text-xs font-semibold uppercase"
              style={{
                background: scoreColor + "15",
                color: scoreColor,
                borderRadius: "9999px",
                letterSpacing: "0.025em",
              }}
            >
              {tier.label}
            </span>
          </div>

          <div className="space-y-10">
            <div>
              <p className="caption text-ash-gray uppercase mb-1">Credit Limit</p>
              <p className="heading-sm text-bone-white">${creditLimit.toLocaleString()}</p>
              <p className="caption text-silver-mist">USDC available to borrow</p>
            </div>

            <div>
              <p className="caption text-ash-gray uppercase mb-1">Available Credit</p>
              <p className="heading-sm text-deep-verdant">${availableCredit.toLocaleString()}</p>
              <p className="caption text-silver-mist">USDC remaining</p>
            </div>
          </div>

          <div className="mt-16 flex gap-6">
            <Link to="/apply" className="btn-primary">
              Apply for Loan
            </Link>
            <Link to="/score" className="ghost-link" style={{ fontSize: "14px", paddingTop: "14px" }}>
              View Score Breakdown
            </Link>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center" style={{ minHeight: "500px" }}>
          <ConstellationVisualization />
        </div>
      </section>

      {/* Active loan card */}
      {activeLoan && (
        <section className="py-12 border-t" style={{ borderColor: "#1a1a1a" }}>
          <span className="accent-text nav-label text-xs block mb-4">Active Loan</span>
          <div className="max-w-2xl p-6 rounded-xl" style={{ background: "#0f0f0f", border: "1px solid #1a1a1a" }}>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="caption text-ash-gray uppercase">Principal</p>
                <p className="body-text text-bone-white">${(Number(activeLoan.principal)/1e6).toLocaleString()} USDC</p>
                <p className="caption text-silver-mist">Term {activeLoan.termDays}d • Due {new Date(activeLoan.dueTimestamp*1000).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="caption text-ash-gray uppercase">Interest</p>
                <p className="body-text text-saffron-spark">${(Number(activeLoan.interest)/1e6).toFixed(2)}</p>
                <p className="caption text-silver-mist">Status {activeLoan.status===0?"ACTIVE":activeLoan.status===1?"REPAID":"DEFAULTED"}</p>
              </div>
            </div>
            {activeLoan.status===0 && (
              <button onClick={() => repay(activeLoan.loanId)} className="btn-primary" style={{ padding: "10px 20px" }}>Repay ${(Number(activeLoan.principal)/1e6 + Number(activeLoan.interest)/1e6).toFixed(2)}</button>
            )}
          </div>
        </section>
      )}

      {/* Score breakdown accordion */}
      {breakdown && (
        <section className="py-12">
          <span className="accent-text nav-label text-xs block mb-4">Score Breakdown</span>
          <div className="max-w-2xl space-y-3">
            {([
              ["ArcPass KYC", breakdown.arcPassKyc],
              ["Reputation", breakdown.arcPassReputation],
              ["Repayment History", breakdown.repaymentHistory],
              ["USDC Throughput", breakdown.usdcThroughput],
              ["Wallet Age", breakdown.walletAge],
            ] as const).map(([label, b]) => (
              <div key={label} className="flex justify-between items-center py-3 px-4 rounded" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
                <div>
                  <p className="body-text text-silver-mist text-sm">{label}</p>
                  <p className="caption text-ash-gray">{b.weighted} / {b.max} pts</p>
                </div>
                <div className="w-24 h-1 ml-4" style={{ background: "#1a1a1a" }}>
                  <div className="h-full" style={{ width: `${(b.weighted/b.max)*100}%`, background: "#8052ff" }} />
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <span className={`px-2 py-1 text-xs rounded ${kycVerified?"bg-green-500/20 text-green-400":"bg-red-500/20 text-red-400"}`}>KYC {kycVerified?"✓":"✗"}</span>
              <span className="px-2 py-1 text-xs rounded bg-white/5 text-silver-mist">Rep {reputationScore}</span>
            </div>
          </div>
        </section>
      )}

      {/* Loan history */}
      {loanHistory.length > 0 && (
        <section className="py-12 border-t" style={{ borderColor: "#1a1a1a" }}>
          <span className="accent-text nav-label text-xs block mb-4">Loan History</span>
          <div className="overflow-x-auto">
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
                {loanHistory.slice(0,10).map((l: any) => (
                  <tr key={l.loanId ?? l.id} style={{ borderBottom: "1px solid #0f0f0f" }}>
                    <td className="py-3 text-bone-white">#{l.loanId ?? l.id}</td>
                    <td className="text-silver-mist">${(Number(l.principal)/1e6).toLocaleString()}</td>
                    <td className="text-silver-mist">{l.termDays}d</td>
                    <td><span className={`px-2 py-1 text-xs rounded ${l.status==="REPAID"||l.status===1?"bg-green-500/20 text-green-400":l.status==="DEFAULTED"||l.status===2?"bg-red-500/20 text-red-400":"bg-yellow-500/20 text-yellow-300"}`}>{String(l.status)}</span></td>
                    <td className="text-ash-gray">{l.dueAt ? new Date(l.dueAt).toLocaleDateString() : l.dueTimestamp ? new Date(l.dueTimestamp*1000).toLocaleDateString() : "-"}</td>
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

function ConstellationVisualization() {
  const particles = Array.from({ length: 120 }, (_, i) => {
    const angle = (i / 120) * Math.PI * 2;
    const radius = 80 + Math.sin(i * 0.7) * 60;
    const x = Math.cos(angle) * radius + 150;
    const y = Math.sin(angle) * radius + 150;
    const colors = ["#8052ff", "#ffb829", "#15846e", "#a855f7", "#3b82f6", "#ec4899"];
    const color = colors[i % colors.length];
    const size = 2 + (i % 3);
    const opacity = 0.4 + (i % 5) * 0.12;
    return { x, y, color, size, opacity, id: i };
  });

  return (
    <svg width="300" height="300" viewBox="0 0 300 300">
      {particles.map((p) => (
        <polygon
          key={p.id}
          points={`${p.x},${p.y - p.size} ${p.x - p.size * 0.866},${p.y + p.size * 0.5} ${p.x + p.size * 0.866},${p.y + p.size * 0.5}`}
          fill="none"
          stroke={p.color}
          strokeWidth="1"
          opacity={p.opacity}
        />
      ))}
      {particles.slice(0, 30).map((p, i) => {
        const next = particles[(i + 1) % particles.length];
        return (
          <line
            key={`line-${i}`}
            x1={p.x}
            y1={p.y}
            x2={next.x}
            y2={next.y}
            stroke="#8052ff"
            strokeWidth="0.3"
            opacity="0.15"
          />
        );
      })}
    </svg>
  );
}
