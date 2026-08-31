# ArcCredit — Project Description

> Reputation-based undercollateralized lending protocol on Arc (Chain ID: 5042002).

---

## What We're Building

ArcCredit is an undercollateralized USDC lending protocol built on Arc L1. Instead of locking crypto as collateral, borrowers earn a **CreditScore (0–1000)** derived from onchain signals. Score gates access to progressively larger USDC credit lines. Lenders deposit USDC into risk-tranched pools and earn yield from interest repayments.

---

## 4-Agent Pipeline

| Agent | Model | Role | Owns |
|---|---|---|---|
| **Architect** | Qwen3 | System design, spec decisions, cross-agent arbitration | AGENTS.md, `/docs/`, ADRs |
| **Implementer** | Claude Sonnet | Write all production code — contracts, backend, frontend | `/contracts/`, `/backend/`, `/frontend/` |
| **Tester** | Gemini 2.5 Pro | Write and run all tests, fuzzing, coverage reports | `/test/`, `/audit/` |
| **Reviewer** | o3 | Final review pass — security, gas, logic, integration | Review comments, sign-off |

### Inter-agent rules
- Architect decides on ambiguity; never guess on protocol logic.
- Implementer never skips NatDoc on public/external functions.
- Tester must hit ≥90% branch coverage before Reviewer is invoked.
- Reviewer blocks merge on any HIGH or CRITICAL finding.
- No agent writes to another agent's owned directories without an explicit handoff note.

---

## 6 Smart Contracts

1. **CreditScoreRegistry** — Aggregates onchain signals into a 0–1000 credit score per wallet. Single source of truth for creditworthiness.
2. **CreditLine** — Per-borrower credit limit gating. Checks score, computes max borrow amount, enforces utilization.
3. **LoanVault** — USDC liquidity pool. Accepts lender deposits, disburses loans, receives repayments, distributes yield.
4. **TranchManager** — Splits lender deposits into Senior (lower yield, protected) and Junior (higher yield, first-loss) tranches.
5. **RepaymentScheduler** — Off-chain job calls this to mark overdue loans as defaulted and trigger score slashing.
6. **ScoreOracle** — Aggregates ArcPass attestation data + chain analytics into a score update for CreditScoreRegistry.

---

## Credit Score Model

5 signals, weighted breakdown:

| Signal | Weight | Max pts |
|---|---|---|
| ArcPass KYC attestation | 25% | 250 |
| ArcPass Reputation score | 20% | 200 |
| Repayment history (this protocol) | 30% | 300 |
| USDC throughput (wallet, 90d) | 15% | 150 |
| Wallet age on Arc | 10% | 100 |
| **Total** | | **1000** |

---

## 6 Credit Tiers

| Score range | Max credit line | Interest rate (APR) |
|---|---|---|
| 0–299 | $0 (no access) | — |
| 300–499 | $50 USDC | 24% |
| 500–649 | $250 USDC | 18% |
| 650–799 | $1,000 USDC | 14% |
| 800–899 | $5,000 USDC | 10% |
| 900–1000 | $20,000 USDC | 7% |

---

## ArcPass Integration

Reads directly from existing `AttestationRegistry` + `ScoreRegistry` via schema IDs. Zero duplication.

### Schemas
| Schema | ID | Used for |
|---|---|---|
| KYC | `bytes32("arc.kyc.v1")` | 250pt score component |
| Reputation | `bytes32("arc.reputation.v1")` | 200pt score component |
| Employment | `bytes32("arc.employment.v1")` | Future: boost creditworthiness |
| Custom | `bytes32("arc.custom.v1")` | Future: regional credit bureau |

---

## Backend Spec

**Stack**: Node.js 20 LTS, TypeScript 5.x, Express 4, PostgreSQL via Prisma ORM, viem + custom arcClient.ts, Bull (Redis-backed) for repayment watcher job, SIWE auth.

### API Routes

```
POST   /api/v1/auth/siwe/nonce          → returns nonce for wallet signing
POST   /api/v1/auth/siwe/verify         → verifies sig, returns JWT

GET    /api/v1/score/:address           → current score + breakdown
POST   /api/v1/score/:address/refresh   → triggers ScoreOracle update (costs oracle gas)

GET    /api/v1/loans/:address           → loan history for borrower
POST   /api/v1/loans/apply             → validate, call LoanVault.requestLoan
POST   /api/v1/loans/:loanId/repay     → build repay tx for frontend to sign

GET    /api/v1/vault/stats             → TVL, utilization, APY by tranche
GET    /api/v1/vault/position/:address  → lender shares + claimable yield

GET    /api/v1/arcpass/:address         → fetch attestations from ArcPass registry
```

---

## Frontend Spec

**Stack**: React 19 + Vite 5, wagmi v2 + viem, TailwindCSS, RainbowKit, Recharts, Circle Wallets SDK.

### Pages
1. **BorrowerDashboard** — Credit score gauge, score breakdown accordion, active loan card, loan history table
2. **ApplyLoan** — Loan amount slider, term selector, interest preview, ArcPass status chips
3. **CreditScore** — Animated score ring, per-signal breakdown bars, score history chart
4. **LenderDashboard** — Vault TVL, deposit/withdraw form, position card, yield claim button

---

## Arc-Specific Constraints

| Constraint | Rule |
|---|---|
| **USDC decimals** | Always `6` on Arc. Never `18`. Use `USDC_DECIMALS = 6` constant. |
| **PREV_RANDAO** | Returns `0` on Arc. Never use `block.prevrandao` as entropy. |
| **Proxy pattern** | Use UUPS (`UUPSUpgradeable`). No Transparent Proxy. |
| **Gas token** | USDC is the gas token. Paymaster sponsorship via Circle. |
| **Chain ID** | `5042002` for testnet. Hardcode in wagmiConfig. |
| **RPC** | `https://rpc.testnet.arc.io` — use this, not a generic ETH RPC. |
| **Finality** | Sub-second — no need for confirmation polling. One block = final. |

---

## Deployment Order

```bash
# 1. Libraries (no constructor deps)
forge script script/Deploy.s.sol --sig "deployLibs()" --broadcast

# 2. CreditScoreRegistry (UUPS proxy)
forge script script/Deploy.s.sol --sig "deployScoreRegistry()" --broadcast

# 3. ScoreOracle (depends on CreditScoreRegistry)
forge script script/Deploy.s.sol --sig "deployScoreOracle()" --broadcast

# 4. CreditLine (depends on CreditScoreRegistry)
forge script script/Deploy.s.sol --sig "deployCreditLine()" --broadcast

# 5. TranchManager (standalone)
forge script script/Deploy.s.sol --sig "deployTranchManager()" --broadcast

# 6. LoanVault (depends on CreditLine + TranchManager)
forge script script/Deploy.s.sol --sig "deployLoanVault()" --broadcast

# 7. RepaymentScheduler (depends on LoanVault + CreditScoreRegistry)
forge script script/Deploy.s.sol --sig "deployRepaymentScheduler()" --broadcast

# 8. Wire permissions
forge script script/Deploy.s.sol --sig "wireContracts()" --broadcast
```

---

## Handoff Checkpoints

```
[ ] Architect  → Implementer : This file is finalized and signed off
[ ] Implementer → Tester     : All contracts compile, natdoc complete, deploy script runs on fork
[ ] Tester     → Reviewer    : Coverage ≥90%, all scenarios pass, fuzz 10k+ runs green
[ ] Reviewer   → Merge       : No HIGH/CRITICAL findings; gas report reviewed; docs updated if spec changed
```
