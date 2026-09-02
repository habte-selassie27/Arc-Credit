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
          <svg width="28" height="24" viewBox="0 0 80 60" fill="none">
            <defs>
              <linearGradient id="navG1" x1="40" y1="0" x2="40" y2="56" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#AFA9EC"/>
                <stop offset="100%" stopColor="#3C3489"/>
              </linearGradient>
              <linearGradient id="navG2" x1="40" y1="0" x2="40" y2="56" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#CECBF6"/>
                <stop offset="100%" stopColor="#534AB7"/>
              </linearGradient>
            </defs>
            <path d="M 22 54 C 22 30, 32 8, 40 4 C 48 8, 58 30, 58 54" fill="none" stroke="url(#navG1)" strokeWidth="9" strokeLinecap="round"/>
            <path d="M 24 52 C 24 30, 33 10, 40 6 C 47 10, 56 30, 56 52" fill="none" stroke="url(#navG2)" strokeWidth="7" strokeLinecap="round"/>
            <path d="M 27 50 C 27 32, 34 14, 40 10 C 46 14, 53 32, 53 50" fill="none" stroke="#CECBF6" strokeWidth="2" strokeLinecap="round" opacity="0.35"/>
            <circle cx="22" cy="54" r="4.5" fill="#534AB7"/>
            <circle cx="58" cy="54" r="4.5" fill="#7F77DD"/>
          </svg>
          <span className="text-bone-white text-sm font-semibold" style={{ letterSpacing: "0.025em" }}>
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
