import { Routes, Route, Link } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import BorrowerDashboard from "./pages/BorrowerDashboard";
import LenderDashboard from "./pages/LenderDashboard";
import CreditScore from "./pages/CreditScore";
import ApplyLoan from "./pages/ApplyLoan";

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
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-12 py-6" style={{ background: "transparent" }}>
        <div className="flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 19h20L12 2z" fill="#8052ff" />
            <path d="M12 8L6 19h12L12 8z" fill="#15846e" opacity="0.6" />
          </svg>
          <span className="text-bone-white text-sm font-semibold" style={{ letterSpacing: "0.025em" }}>
            ArcCredit
          </span>
        </div>

        <div className="flex items-center gap-10">
          <Link to="/" className="ghost-link nav-label">Borrow</Link>
          <Link to="/lender" className="ghost-link nav-label">Lend</Link>
          <Link to="/score" className="ghost-link nav-label">Score</Link>
          <WalletButton />
        </div>
      </nav>

      <main className="pt-28">
        <Routes>
          <Route path="/" element={<BorrowerDashboard />} />
          <Route path="/lender" element={<LenderDashboard />} />
          <Route path="/score" element={<CreditScore />} />
          <Route path="/apply" element={<ApplyLoan />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
