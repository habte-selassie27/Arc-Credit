import { Routes, Route, Link, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import BorrowerDashboard from "./pages/BorrowerDashboard";
import LenderDashboard from "./pages/LenderDashboard";
import CreditScore from "./pages/CreditScore";
import ApplyLoan from "./pages/ApplyLoan";
import Landing from "./pages/Landing";

function NavButton({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className="px-5 py-2 text-sm font-semibold uppercase"
      style={{
        background: isActive ? "#534AB7" : "transparent",
        color: isActive ? "#fff" : "#9a9a9a",
        borderRadius: "9999px",
        border: isActive ? "none" : "1px solid #222",
        letterSpacing: "0.025em",
        textDecoration: "none",
        transition: "all 0.2s",
      }}
    >
      {label}
    </Link>
  );
}

function WalletButton() {
  return (
    <ConnectButton
      accountStatus="address"
      chainStatus="icon"
      showBalance={false}
    />
  );
}

function App() {
  return (
    <div className="min-h-screen bg-void">
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 py-6" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3">
          <svg width="40" height="34" viewBox="0 0 120 100" fill="none">
            <defs>
              <linearGradient id="navA" x1="60" y1="0" x2="60" y2="90" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#CECBF6"/>
                <stop offset="40%" stopColor="#7F77DD"/>
                <stop offset="100%" stopColor="#3C3489"/>
              </linearGradient>
              <linearGradient id="navR" x1="10" y1="80" x2="110" y2="10" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#534AB7"/>
                <stop offset="50%" stopColor="#AFA9EC"/>
                <stop offset="100%" stopColor="#7F77DD"/>
              </linearGradient>
            </defs>
            <path d="M 48 8 L 20 88" stroke="url(#navA)" strokeWidth="16" strokeLinecap="round"/>
            <path d="M 48 8 L 76 88" stroke="url(#navA)" strokeWidth="16" strokeLinecap="round"/>
            <path d="M 28 60 L 68 60" stroke="#7F77DD" strokeWidth="6" strokeLinecap="round" opacity="0.7"/>
            <path d="M 16 82 C 16 40, 48 8, 80 8 C 100 8, 112 28, 112 48" fill="none" stroke="url(#navR)" strokeWidth="10" strokeLinecap="round"/>
            <path d="M 20 78 C 20 42, 48 14, 78 14 C 96 14, 106 30, 106 46" fill="none" stroke="#CECBF6" strokeWidth="3" strokeLinecap="round" opacity="0.4"/>
            <circle cx="16" cy="86" r="5" fill="#534AB7"/>
            <circle cx="80" cy="86" r="5" fill="#7F77DD"/>
          </svg>
          <span className="text-bone-white text-base font-semibold" style={{ letterSpacing: "0.025em" }}>
            ArcCredit
          </span>
        </div>

        <div className="flex items-center gap-2">
          <NavButton to="/borrow" label="Borrow" />
          <NavButton to="/lender" label="Lend" />
          <NavButton to="/score" label="Score" />
          <div className="ml-4">
            <WalletButton />
          </div>
        </div>
      </nav>

      <main className="pt-28">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/borrow" element={<BorrowerDashboard />} />
          <Route path="/lender" element={<LenderDashboard />} />
          <Route path="/score" element={<CreditScore />} />
          <Route path="/apply" element={<ApplyLoan />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
