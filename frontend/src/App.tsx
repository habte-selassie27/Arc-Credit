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
          <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" fill="#26215C"/>
            <path d="M 32 6 A 26 26 0 1 1 7.4 49" stroke="#AFA9EC" strokeWidth="5.5" strokeLinecap="round"/>
            <path d="M 7.4 49 A 26 26 0 0 1 32 6" stroke="#3C3489" strokeWidth="5.5" strokeLinecap="round"/>
            <circle cx="32" cy="6" r="4" fill="#AFA9EC"/>
            <circle cx="7.4" cy="49" r="4" fill="#7F77DD"/>
            <text x="32" y="39" textAnchor="middle" fontSize="14" fontWeight="700" fill="#EEEDFE" fontFamily="system-ui,sans-serif">AC</text>
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
