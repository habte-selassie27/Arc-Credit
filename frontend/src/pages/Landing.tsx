import { Link } from "react-router-dom";
import { useAccount } from "wagmi";

const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: "No collateral needed",
    desc: "Your onchain history is your creditworthiness. Borrow USDC without locking assets.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: "Instant disbursement",
    desc: "Sub-second finality on Arc. Loan hits your wallet the moment it's approved.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.5">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    title: "Reputation-based scoring",
    desc: "ArcPass attestations + repayment history + onchain activity feed a fair 0–1000 credit score.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.5">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
      </svg>
    ),
    title: "Risk-tranched pools",
    desc: "Lenders choose Senior (protected) or Junior (higher yield). Losses absorbed bottom-up.",
  },
];

const TIERS = [
  { label: "Starter", score: "300", limit: "$50", color: "#ffb829" },
  { label: "Bronze", score: "500", limit: "$250", color: "#ffb829" },
  { label: "Silver", score: "650", limit: "$1,000", color: "#bdbdbd" },
  { label: "Gold", score: "800", limit: "$5,000", color: "#ffb829" },
  { label: "Platinum", score: "900", limit: "$20,000", color: "#7F77DD" },
];

export default function Landing() {
  const { address } = useAccount();

  return (
    <div className="max-w-page mx-auto px-12">
      {/* Hero */}
      <section className="flex flex-col items-center text-center" style={{ minHeight: "80vh", justifyContent: "center" }}>
        <p className="nav-label text-xs mb-6" style={{ color: "#7F77DD" }}>Arc Testnet</p>
        <h1 className="heading-lg text-bone-white mb-6">
          Credit without<br />collateral.
        </h1>
        <p className="body-text text-silver-mist max-w-lg mb-12">
          ArcCredit uses onchain identity to unlock USDC credit lines. No collateral, no bank, just your reputation.
        </p>

        <div className="flex gap-4">
          <Link to={address ? "/borrow" : "/borrow"} className="btn-primary">
            {address ? "View your score" : "Get started"}
          </Link>
          <Link
            to="/lender"
            className="btn-primary"
            style={{ background: "transparent", border: "1px solid #534AB7", color: "#7F77DD" }}
          >
            Lend USDC
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="py-24 border-t" style={{ borderColor: "#1a1a1a" }}>
        <div className="grid grid-cols-4 gap-12 text-center">
          {[
            { value: "6", label: "Score tiers", sub: "0–1000 scale" },
            { value: "$20k", label: "Max credit line", sub: "Platinum tier" },
            { value: "7%", label: "Lowest APR", sub: "Platinum tier" },
            { value: "<1s", label: "Finality", sub: "Arc L1" },
          ].map((s) => (
            <div key={s.label}>
              <p className="mono" style={{ fontSize: "36px", fontWeight: 600, color: "#fff" }}>{s.value}</p>
              <p className="body-text text-bone-white mt-2">{s.label}</p>
              <p className="caption text-ash-gray">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 border-t" style={{ borderColor: "#1a1a1a" }}>
        <p className="nav-label text-xs mb-3" style={{ color: "#7F77DD" }}>How it works</p>
        <h2 className="heading-sm text-bone-white mb-16">Three steps to credit.</h2>

        <div className="grid grid-cols-3 gap-12">
          {[
            { step: "01", title: "Connect & attest", desc: "Link your wallet. ArcPass verifies your identity and builds your onchain profile." },
            { step: "02", title: "Score & unlock", desc: "Your score is computed from KYC, reputation, repayment history, volume, and wallet age." },
            { step: "03", title: "Borrow & repay", desc: "Draw from your credit line. Repay on time to grow your score and unlock higher limits." },
          ].map((s) => (
            <div key={s.step}>
              <span className="mono" style={{ fontSize: "48px", fontWeight: 600, color: "#534AB7", opacity: 0.4 }}>{s.step}</span>
              <h3 className="body-text text-bone-white font-medium mt-4 mb-2">{s.title}</h3>
              <p className="caption text-silver-mist">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-t" style={{ borderColor: "#1a1a1a" }}>
        <p className="nav-label text-xs mb-3" style={{ color: "#7F77DD" }}>Built for Arc</p>
        <h2 className="heading-sm text-bone-white mb-16">Why ArcCredit.</h2>

        <div className="grid grid-cols-2 gap-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4" style={{ padding: "24px", background: "#0a0a0a", borderRadius: "16px", border: "1px solid #1a1a1a" }}>
              <div className="signal-icon" style={{ background: "#534AB715", flexShrink: 0 }}>
                {f.icon}
              </div>
              <div>
                <h3 className="body-text text-bone-white font-medium mb-1">{f.title}</h3>
                <p className="caption text-silver-mist">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Credit tiers preview */}
      <section className="py-24 border-t" style={{ borderColor: "#1a1a1a" }}>
        <p className="nav-label text-xs mb-3" style={{ color: "#7F77DD" }}>Tiers</p>
        <h2 className="heading-sm text-bone-white mb-16">Score unlocks limits.</h2>

        <div className="space-y-0" style={{ maxWidth: "640px" }}>
          {TIERS.map((t) => (
            <div
              key={t.label}
              className="flex items-center gap-4"
              style={{ padding: "14px 12px", borderBottom: "1px solid #1a1a1a" }}
            >
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: t.color }} />
              <span className="mono caption" style={{ color: "#9a9a9a" }}>{t.score}+</span>
              <span className="body-text text-bone-white flex-1">{t.label}</span>
              <span className="mono body-text text-silver-mist">{t.limit}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 text-center border-t" style={{ borderColor: "#1a1a1a" }}>
        <h2 className="heading-sm text-bone-white mb-6">
          Ready to borrow?
        </h2>
        <p className="body-text text-silver-mist max-w-md mx-auto mb-10">
          Connect your wallet and check your score. No collateral required.
        </p>
        <Link to="/borrow" className="btn-primary">
          Check your score
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t flex items-center justify-between" style={{ borderColor: "#1a1a1a" }}>
        <div className="flex items-center gap-3">
          <svg width="18" height="15" viewBox="0 0 80 60" fill="none">
            <defs>
              <linearGradient id="ftG1" x1="40" y1="0" x2="40" y2="56" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#AFA9EC"/>
                <stop offset="100%" stopColor="#3C3489"/>
              </linearGradient>
              <linearGradient id="ftG2" x1="40" y1="0" x2="40" y2="56" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#CECBF6"/>
                <stop offset="100%" stopColor="#534AB7"/>
              </linearGradient>
            </defs>
            <path d="M 22 54 C 22 30, 32 8, 40 4 C 48 8, 58 30, 58 54" fill="none" stroke="url(#ftG1)" strokeWidth="9" strokeLinecap="round"/>
            <path d="M 24 52 C 24 30, 33 10, 40 6 C 47 10, 56 30, 56 52" fill="none" stroke="url(#ftG2)" strokeWidth="7" strokeLinecap="round"/>
            <path d="M 27 50 C 27 32, 34 14, 40 10 C 46 14, 53 32, 53 50" fill="none" stroke="#CECBF6" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
            <circle cx="22" cy="54" r="4.5" fill="#534AB7"/>
            <circle cx="58" cy="54" r="4.5" fill="#7F77DD"/>
          </svg>
          <span className="caption text-ash-gray">ArcCredit</span>
        </div>
        <p className="caption text-ash-gray">Built on Arc Testnet</p>
      </footer>
    </div>
  );
}
