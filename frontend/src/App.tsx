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
          <svg width="80" height="68" viewBox="0 0 120 100" fill="none">
            <defs>
              <linearGradient id="navABody" x1="50" y1="0" x2="50" y2="95" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#CECBF6"/>
                <stop offset="35%" stopColor="#AFA9EC"/>
                <stop offset="70%" stopColor="#7F77DD"/>
                <stop offset="100%" stopColor="#534AB7"/>
              </linearGradient>
              <linearGradient id="navADark" x1="50" y1="0" x2="50" y2="95" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#7F77DD"/>
                <stop offset="100%" stopColor="#3C3489"/>
              </linearGradient>
              <linearGradient id="navARibbon" x1="10" y1="75" x2="110" y2="15" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#534AB7"/>
                <stop offset="40%" stopColor="#AFA9EC"/>
                <stop offset="70%" stopColor="#CECBF6"/>
                <stop offset="100%" stopColor="#7F77DD"/>
              </linearGradient>
            </defs>
            <path d="M 52 5 L 18 90 L 38 90 L 52 50 Z" fill="url(#navADark)"/>
            <path d="M 52 5 L 86 90 L 66 90 L 52 50 Z" fill="url(#navABody)"/>
            <path d="M 26 62 L 78 62 L 74 52 L 30 52 Z" fill="url(#navADark)" opacity="0.6"/>
            <path d="M 14 82 C 14 42, 42 10, 72 8 C 92 6, 108 22, 112 42 C 108 38, 92 28, 72 30 C 48 32, 22 54, 22 78 Z" fill="url(#navADark)" opacity="0.5"/>
            <path d="M 18 80 C 18 44, 44 14, 72 12 C 90 10, 104 24, 108 40 C 100 34, 86 26, 72 28 C 50 30, 26 52, 26 76 Z" fill="url(#navARibbon)"/>
            <path d="M 22 76 C 22 48, 46 20, 72 18 C 88 16, 100 28, 104 38 C 96 32, 84 26, 72 28 C 52 30, 30 50, 30 72 Z" fill="#CECBF6" opacity="0.3"/>
          </svg>
          <span className="text-bone-white text-xl font-semibold" style={{ letterSpacing: "0.025em" }}>
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
