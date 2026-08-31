import { Router } from "express";
import { getLoanHistory, getActiveLoan, applyLoan, buildRepayTx, validateLoanRequest } from "../services/loanService";

const router = Router();

router.get("/:address", async (req, res) => {
  const { address } = req.params;
  try {
    const loans = await getLoanHistory(address);
    const active = await getActiveLoan(address);
    res.json({ active, history: loans });
  } catch (err) {
    res.status(500).json({ error: "failed to fetch loans" });
  }
});

router.post("/apply", async (req, res) => {
  const { address, amount, termDays } = req.body;
  if (!address || !amount || !termDays) {
    res.status(400).json({ error: "address, amount, termDays required" });
    return;
  }

  try {
    // Validate credit via on-chain view; frontend will sign the tx
    const result = await applyLoan(address, BigInt(amount), Number(termDays));
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "loan application failed" });
  }
});

router.get("/:address/validate", async (req, res) => {
  const { address } = req.params;
  const { amount, termDays } = req.query as any;
  if (!amount || !termDays) {
    res.status(400).json({ error: "amount, termDays required" });
    return;
  }
  try {
    const v = await validateLoanRequest(address, BigInt(amount), Number(termDays));
    res.json({ valid: true, available: v.available.toString(), rateBps: v.rate.toString(), interest: v.interest.toString(), totalDue: v.totalDue.toString() });
  } catch (e: any) {
    res.status(400).json({ valid: false, error: e.message });
  }
});

router.post("/:loanId/repay", async (req, res) => {
  const { loanId } = req.params;
  try {
    const tx = await buildRepayTx(Number(loanId));
    res.json(tx);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export { router as loanRoutes };
