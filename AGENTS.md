# AGENTS.md — ArcCredit

> Reputation-based undercollateralized lending protocol on Arc (Chain ID: 5042002).
> Borrowers unlock USDC credit lines backed by onchain identity instead of collateral.
> This file is the single source of truth for every AI agent in the dev pipeline.

---

## 0. Agent Roster & Responsibilities

| Agent | Model | Role | Owns |
|---|---|---|---|
| **Architect** | Qwen3 | System design, spec decisions, cross-agent arbitration | This file, `/docs/`, ADRs |
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

## 1. Project Overview

**ArcCredit** is an undercollateralized USDC lending protocol built on Arc L1. Instead of locking crypto as collateral, borrowers earn a **CreditScore (0–1000)** derived from onchain signals. Score gates access to progressively larger USDC credit lines. Lenders deposit USDC into risk-tranched pools and earn yield from interest repayments.

### Core value props
- Zero collateral for borrowers with proven onchain history
- ArcPass attestations as the identity anchor (KYC, reputation, employment)
- USDC-native: all loans, repayments, fees in USDC (6 decimals on Arc)
- Sub-second deterministic finality for instant disbursement
- Slashing-based default penalty: missed repayment burns score, not wallet

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        ArcCredit                            │
│                                                             │
│  ┌───────────────┐    ┌───────────────┐    ┌─────────────┐ │
│  │ CreditScore   │───▶│  CreditLine   │───▶│  LoanVault  │ │
│  │   Registry    │    │   (per user)  │    │  (USDC pool)│ │
│  └───────┬───────┘    └───────┬───────┘    └──────┬──────┘ │
│          │                    │                   │        │
│  ┌───────▼───────┐    ┌───────▼───────┐    ┌──────▼──────┐ │
│  │  ScoreOracle  │    │  Repayment    │    │  Tranche    │ │
│  │  (Aggregator) │    │  Scheduler   │    │  Manager    │ │
│  └───────┬───────┘    └───────────────┘    └─────────────┘ │
│          │                                                  │
│  ┌───────▼───────────────────────────────────────────────┐ │
│  │              ArcPass Integration Layer                 │ │
│  │   AttestationRegistry · ScoreRegistry · PassportVerif │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### External dependencies
- **ArcPass** (`AttestationRegistry`, `ScoreRegistry`) — identity + reputation attestations
- **Chainlink** — USDC/USD price feed, interest rate oracle
- **Circle Developer-Controlled Wallets SDK** — gasless onboarding for borrowers
- **CCTP** — lender funding from Ethereum/other chains into Arc LoanVault

---

## 3. Monorepo Structure

```
arccredit/
├── AGENTS.md                  ← this file
├── README.md
├── .env.example
├── foundry.toml
├── package.json               ← root workspace
│
├── contracts/                 ← Implementer
│   ├── src/
│   │   ├── CreditScoreRegistry.sol
│   │   ├── CreditLine.sol
│   │   ├── LoanVault.sol
│   │   ├── RepaymentScheduler.sol
│   │   ├── TranchManager.sol
│   │   ├── ScoreOracle.sol
│   │   ├── interfaces/
│   │   │   ├── ICreditScoreRegistry.sol
│   │   │   ├── ICreditLine.sol
│   │   │   ├── ILoanVault.sol
│   │   │   └── IArcPass.sol
│   │   └── libraries/
│   │       ├── CreditMath.sol
│   │       └── InterestLib.sol
│   ├── script/
│   │   ├── Deploy.s.sol
│   │   └── Seed.s.sol
│   └── test/                  ← Tester
│       ├── unit/
│       ├── integration/
│       └── fuzz/
│
├── backend/                   ← Implementer
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── scoreAggregator.ts
│   │   │   ├── loanService.ts
│   │   │   └── arcpassClient.ts
│   │   ├── jobs/
│   │   │   └── repaymentWatcher.ts
│   │   └── lib/
│   │       └── arcClient.ts
│   └── prisma/
│       └── schema.prisma
│
├── frontend/                  ← Implementer
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── BorrowerDashboard.tsx
│   │   │   ├── LenderDashboard.tsx
│   │   │   ├── CreditScore.tsx
│   │   │   └── ApplyLoan.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   │   ├── useCreditScore.ts
│   │   │   ├── useLoanVault.ts
│   │   │   └── useArcPass.ts
│   │   └── lib/
│   │       ├── wagmiConfig.ts
│   │       └── contracts.ts
│   └── vite.config.ts
│
└── docs/
    ├── ADR-001-score-model.md
    ├── ADR-002-tranche-design.md
    └── ADR-003-arcpass-integration.md
```

---

## 4. Smart Contracts

### 4.1 CreditScoreRegistry.sol

**Purpose**: Aggregates onchain signals into a 0–1000 credit score per wallet. Single source of truth for creditworthiness.

**Storage**
```solidity
struct CreditProfile {
    uint16  score;           // 0–1000
    uint32  lastUpdated;     // unix timestamp
    uint32  totalLoans;
    uint32  repaidLoans;
    uint32  defaultedLoans;
    uint96  totalVolumeUSDC; // lifetime USDC repaid, 6 decimals
    bool    arcPassVerified;
}

mapping(address => CreditProfile) public profiles;
mapping(address => bool)          public authorizedOracles;
```

**Score model** (implemented in `CreditMath.sol`)
| Signal | Weight | Max pts |
|---|---|---|
| ArcPass KYC attestation | 25% | 250 |
| ArcPass Reputation score | 20% | 200 |
| Repayment history (this protocol) | 30% | 300 |
| USDC throughput (wallet, 90d) | 15% | 150 |
| Wallet age on Arc | 10% | 100 |
| **Total** | | **1000** |

**Key functions**
```solidity
function getScore(address borrower) external view returns (uint16);
function updateScore(address borrower) external;           // callable by oracle
function slashScore(address borrower, uint16 penalty) external; // on default
function initProfile(address borrower) external;           // on first loan app
```

**Access control**: `Ownable` + `authorizedOracles` whitelist. ScoreOracle is the only writer.

**Upgrade pattern**: UUPS proxy (matches ArcPass pattern — keeps deployment consistent).

---

### 4.2 CreditLine.sol

**Purpose**: Per-borrower credit limit gating. Checks score, computes max borrow amount, enforces utilization.

**Credit tiers**
| Score range | Max credit line | Interest rate (APR) |
|---|---|---|
| 0–299 | $0 (no access) | — |
| 300–499 | $50 USDC | 24% |
| 500–649 | $250 USDC | 18% |
| 650–799 | $1,000 USDC | 14% |
| 800–899 | $5,000 USDC | 10% |
| 900–1000 | $20,000 USDC | 7% |

**Key functions**
```solidity
function getCreditLimit(address borrower) external view returns (uint256);
function getAvailableCredit(address borrower) external view returns (uint256);
function lockCredit(address borrower, uint256 amount) external; // called by LoanVault on disburse
function releaseCredit(address borrower, uint256 amount) external; // called on repayment
function getInterestRate(address borrower) external view returns (uint256); // basis points
```

**Constraints**
- One active loan per borrower at a time (enforced by `activeLoanId` mapping)
- Credit limit recalculated on every `updateScore` call
- Utilization resets only on full repayment, not partial

---

### 4.3 LoanVault.sol

**Purpose**: USDC liquidity pool. Accepts lender deposits, disburses loans, receives repayments, distributes yield.

**Storage**
```solidity
struct Loan {
    address  borrower;
    uint256  principal;      // USDC 6 decimals
    uint256  interest;       // precomputed at disbursement
    uint256  dueTimestamp;
    uint8    termDays;       // 7 | 14 | 30 | 90
    LoanStatus status;       // ACTIVE | REPAID | DEFAULTED
}

enum LoanStatus { ACTIVE, REPAID, DEFAULTED }

mapping(uint256 => Loan)    public loans;
mapping(address => uint256) public activeLoanId;
uint256 public nextLoanId;
uint256 public totalDeposited;
uint256 public totalLent;
```

**Key functions**
```solidity
// Lender side
function deposit(uint256 amount, uint8 tranche) external;
function withdraw(uint256 shares, uint8 tranche) external;
function claimYield() external;

// Borrower side
function requestLoan(uint256 amount, uint8 termDays) external returns (uint256 loanId);
function repay(uint256 loanId) external;

// Admin/system
function markDefault(uint256 loanId) external; // called by RepaymentScheduler after grace period
```

**Interest calculation** (in `InterestLib.sol`)
```
interest = principal × APR × termDays / 365 / 10000
total_due = principal + interest
protocol_fee = interest × 10%   // goes to treasury
lender_yield = interest × 90%   // distributed to tranche depositors
```

**Arc-specific note**: USDC on Arc is 6 decimals. All amounts stored and computed in 6-decimal precision. Never assume 18 decimals. Use `USDC_DECIMALS = 6` constant throughout.

---

### 4.4 TranchManager.sol

**Purpose**: Splits lender deposits into Senior (lower yield, protected) and Junior (higher yield, first-loss) tranches.

**Tranche design**
| Tranche | Yield share | Loss absorption | Min deposit |
|---|---|---|---|
| Senior (0) | 60% of pool yield | Last to take losses | 10 USDC |
| Junior (1) | 40% of pool yield | First to take losses | 5 USDC |

**Key functions**
```solidity
function deposit(address lender, uint256 amount, uint8 tranche) external;
function withdraw(address lender, uint256 shares, uint8 tranche) external;
function distributeYield(uint256 totalYield) external;
function absorbLoss(uint256 lossAmount) external;
function getShares(address lender, uint8 tranche) external view returns (uint256);
```

---

### 4.5 RepaymentScheduler.sol

**Purpose**: Off-chain job calls this to mark overdue loans as defaulted and trigger score slashing.

**Key functions**
```solidity
function checkAndMarkDefault(uint256 loanId) external;
// Grace period: 48h after dueTimestamp
// On default:
//   1. LoanVault.markDefault(loanId)
//   2. CreditScoreRegistry.slashScore(borrower, penaltyPoints)
//   3. emit LoanDefaulted(loanId, borrower, principal)
```

**Slash penalties**
| Loan size | Score slash |
|---|---|
| < $50 | −150 pts |
| $50–$1,000 | −300 pts |
| > $1,000 | −500 pts |

Score cannot go below 0. Slash is permanent (no time decay) — borrower must rebuild via repayments.

---

### 4.6 ScoreOracle.sol

**Purpose**: Aggregates ArcPass attestation data + chain analytics into a score update for CreditScoreRegistry.

**Key functions**
```solidity
function requestScoreUpdate(address borrower) external;
function fulfillScoreUpdate(
    address borrower,
    uint16  arcPassKycScore,
    uint16  arcPassRepScore,
    uint96  usdcThroughput90d,
    uint32  walletAgeDays
) external; // called by trusted backend oracle
```

**Oracle trust model**: Single trusted backend signer (EOA) in testnet. Move to Chainlink Functions or decentralized oracle network post-mainnet.

---

## 5. Backend (Node.js / Express / TypeScript)

### 5.1 Stack
- **Runtime**: Node.js 20 LTS, TypeScript 5.x
- **Framework**: Express 4
- **DB**: PostgreSQL via Prisma ORM
- **Chain client**: viem + custom `arcClient.ts` (Arc RPC: `https://rpc.testnet.arc.io`)
- **Queue**: Bull (Redis-backed) for repayment watcher job
- **Auth**: SIWE (Sign-In with Ethereum) — wallet signs message, backend issues JWT

### 5.2 API Routes

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

### 5.3 Score Aggregator Service (`scoreAggregator.ts`)

```typescript
interface ScoreBreakdown {
  arcPassKyc:       { raw: number; weighted: number; max: 250 };
  arcPassReputation:{ raw: number; weighted: number; max: 200 };
  repaymentHistory: { raw: number; weighted: number; max: 300 };
  usdcThroughput:   { raw: number; weighted: number; max: 150 };
  walletAge:        { raw: number; weighted: number; max: 100 };
  total:            number; // 0–1000
}

async function computeScore(address: string): Promise<ScoreBreakdown>
```

- Fetches ArcPass attestations via `arcpassClient.ts`
- Queries Arc RPC for wallet tx history (last 90 days)
- Queries internal DB for repayment history
- Returns breakdown + total, calls `ScoreOracle.fulfillScoreUpdate` on-chain

### 5.4 Repayment Watcher Job (`repaymentWatcher.ts`)

- Runs every 10 minutes via Bull queue
- Queries DB for loans where `dueTimestamp + 172800 < now()` (48h grace)
- Calls `RepaymentScheduler.checkAndMarkDefault(loanId)` for each
- Emits webhook to borrower (email/push notification)

### 5.5 Prisma Schema (key models)

```prisma
model Loan {
  id            Int       @id @default(autoincrement())
  loanId        Int       @unique  // onchain loanId
  borrower      String
  principal     BigInt              // USDC 6 decimals
  interest      BigInt
  termDays      Int
  dueAt         DateTime
  status        LoanStatus @default(ACTIVE)
  txHash        String
  createdAt     DateTime  @default(now())
}

model ScoreSnapshot {
  id            Int      @id @default(autoincrement())
  address       String
  score         Int
  breakdown     Json
  snapshotAt    DateTime @default(now())
}

enum LoanStatus { ACTIVE REPAID DEFAULTED }
```

---

## 6. Frontend (React 19 / Vite / wagmi / viem)

### 6.1 Stack
- **React 19** + **Vite 5**
- **wagmi v2** + **viem** for contract interactions
- **TailwindCSS** for styling
- **RainbowKit** for wallet connection
- **Recharts** for score history + vault analytics charts
- **Circle Wallets SDK** for gasless borrower onboarding

### 6.2 wagmi Config (`lib/wagmiConfig.ts`)

```typescript
import { defineChain } from 'viem'

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.io'] } },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.testnet.arc.io' }
  },
  testnet: true,
})
```

### 6.3 Pages

#### `BorrowerDashboard.tsx`
- Credit score gauge (0–1000, color-coded by tier)
- Score breakdown accordion (KYC / Reputation / History / Volume / Age)
- Active loan card: principal, interest, due date, countdown, repay button
- Loan history table: past loans, status badges, repayment dates
- "Apply for Loan" CTA → `ApplyLoan.tsx`

#### `ApplyLoan.tsx`
- Slider: loan amount (capped at available credit)
- Term selector: 7 / 14 / 30 / 90 days
- Interest preview: total due, APR, disbursement date
- ArcPass attestation status chips (KYC ✅ / Reputation ✅)
- Submit → calls backend `/api/v1/loans/apply` → signs tx

#### `CreditScore.tsx`
- Animated score ring
- Per-signal breakdown bars with tooltips explaining each signal
- Score history line chart (last 30 snapshots)
- "Refresh Score" button (calls oracle, 60s cooldown)

#### `LenderDashboard.tsx`
- Vault TVL, utilization rate, projected APY by tranche
- Deposit/Withdraw form with tranche selector (Senior / Junior)
- Position card: shares owned, current value, claimable yield
- Yield claim button
- Risk metrics: default rate, total loans outstanding

### 6.4 Key Hooks

```typescript
// useCreditScore.ts
function useCreditScore(address: string): {
  score: number;
  breakdown: ScoreBreakdown;
  tier: CreditTier;
  creditLimit: bigint;
  availableCredit: bigint;
  isLoading: boolean;
}

// useLoanVault.ts
function useLoanVault(): {
  activeLoan: Loan | null;
  loanHistory: Loan[];
  requestLoan: (amount: bigint, termDays: number) => Promise<TxHash>;
  repay: (loanId: number) => Promise<TxHash>;
}

// useArcPass.ts
function useArcPass(address: string): {
  attestations: Attestation[];
  kycVerified: boolean;
  reputationScore: number;
  isLoading: boolean;
}
```

---

## 7. ArcPass Integration

ArcCredit consumes ArcPass attestations as the identity/reputation anchor. Never reimplement identity logic — always read from ArcPass contracts.

### Contracts to read (from ArcPass deployment)
```solidity
// IArcPass.sol
interface IArcPass {
    function getAttestation(address subject, bytes32 schemaId)
        external view returns (Attestation memory);

    function getReputationScore(address subject)
        external view returns (uint16 score, uint32 updatedAt);

    function isKYCVerified(address subject)
        external view returns (bool);
}
```

### Schema IDs to query
| Schema | ID | Used for |
|---|---|---|
| KYC | `bytes32("arc.kyc.v1")` | 250pt score component |
| Reputation | `bytes32("arc.reputation.v1")` | 200pt score component |
| Employment | `bytes32("arc.employment.v1")` | Future: boost creditworthiness |
| Custom | `bytes32("arc.custom.v1")` | Future: regional credit bureau |

### Attestation freshness rule
- KYC: valid for 365 days from issuedAt
- Reputation: valid for 30 days — if stale, score component = 0; prompt user to refresh on ArcPass

---

## 8. Arc-Specific Constraints

These burned Joshua before on ArcPass — every agent must respect them:

| Constraint | Rule |
|---|---|
| **USDC decimals** | Always `6` on Arc. Never `18`. Use `USDC_DECIMALS = 6` constant. |
| **PREV_RANDAO** | Returns `0` on Arc. Never use `block.prevrandao` as entropy. Use Chainlink VRF or commit-reveal if randomness is needed. |
| **Proxy pattern** | Use UUPS (`UUPSUpgradeable`). No Transparent Proxy. Matches ArcPass. |
| **Gas token** | USDC is the gas token. Paymaster sponsorship via Circle for gasless borrower UX. |
| **Chain ID** | `5042002` for testnet. Hardcode in wagmiConfig, never derive dynamically. |
| **RPC** | `https://rpc.testnet.arc.io` — use this, not a generic ETH RPC. |
| **Finality** | Sub-second — no need for confirmation polling. One block = final. |

---

## 9. Environment Variables

```bash
# .env.example

# Arc
ARC_RPC_URL=https://rpc.testnet.arc.io
ARC_CHAIN_ID=5042002
DEPLOYER_PRIVATE_KEY=

# Contracts (populated post-deploy)
CREDIT_SCORE_REGISTRY_ADDRESS=
CREDIT_LINE_ADDRESS=
LOAN_VAULT_ADDRESS=
REPAYMENT_SCHEDULER_ADDRESS=
TRANCHE_MANAGER_ADDRESS=
SCORE_ORACLE_ADDRESS=

# ArcPass (existing deployment)
ARCPASS_ATTESTATION_REGISTRY=
ARCPASS_SCORE_REGISTRY=

# USDC on Arc
USDC_ADDRESS=0x...

# Circle
CIRCLE_API_KEY=
CIRCLE_WALLET_SET_ID=

# Chainlink (Arc testnet)
CHAINLINK_USDC_USD_FEED=

# Backend
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=
ORACLE_SIGNER_PK=         # backend oracle EOA private key

# Frontend
VITE_API_URL=http://localhost:3000
VITE_CREDIT_SCORE_REGISTRY=
VITE_CREDIT_LINE=
VITE_LOAN_VAULT=
VITE_TRANCHE_MANAGER=
VITE_WALLETCONNECT_PROJECT_ID=
```

---

## 10. Deployment Order

Run in this exact order — contracts have dependencies:

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
# Sets: ScoreOracle as authorized oracle on CreditScoreRegistry
#       LoanVault as authorized caller on CreditLine
#       RepaymentScheduler as authorized caller on LoanVault + CreditScoreRegistry
```

---

## 11. Testing Requirements (Tester agent owns this)

### Coverage targets
- **Unit tests**: every public/external function in isolation — ≥90% branch coverage
- **Integration tests**: full loan lifecycle (apply → disburse → repay → score update)
- **Fuzz tests**: `CreditMath.sol` scoring formula, `InterestLib.sol` interest calc
- **Invariant tests**: `totalDeposited >= totalLent` always holds in LoanVault

### Key test scenarios

```
CreditScoreRegistry
  ✓ initProfile creates zeroed profile
  ✓ updateScore with mock oracle values produces correct weighted total
  ✓ slashScore clamps at 0, never underflows
  ✓ slashScore by unauthorized caller reverts

CreditLine
  ✓ score < 300 returns 0 credit limit
  ✓ score 300–499 returns 50 USDC limit
  ✓ lockCredit reduces available credit
  ✓ double borrow reverts (one active loan per borrower)

LoanVault
  ✓ deposit mints correct shares
  ✓ requestLoan transfers USDC to borrower, updates activeLoanId
  ✓ repay marks loan REPAID, triggers releaseCredit, distributes yield
  ✓ repay with insufficient USDC reverts
  ✓ invariant: totalDeposited >= totalLent (fuzz 10,000 runs)

RepaymentScheduler
  ✓ checkAndMarkDefault before grace period → no-op
  ✓ checkAndMarkDefault after grace period → marks DEFAULTED, calls slashScore
  ✓ correct slash penalty per loan size tier
```

### Fuzz targets
```solidity
function testFuzz_interestNeverExceedsPrincipal(
    uint256 principal, uint16 score, uint8 termDays
) public { ... }

function testFuzz_scoreAlwaysClamped(
    uint16 kycRaw, uint16 repRaw, uint96 volume, uint32 age
) public { ... }
```

---

## 12. Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Oracle manipulation (fake high score) | Oracle signer key is HSM-protected; score inputs validated on-chain against reasonable bounds |
| ArcPass stale attestations | Freshness check in ScoreOracle; stale = 0 pts for that component |
| LoanVault insolvency (defaults exceed junior tranche) | Senior tranche protected; protocol treasury holds 5% reserve buffer |
| Front-running loan requests | Commit-reveal for large loans (>$1,000) |
| UUPS upgrade key compromise | 48h timelock on upgrades; multisig owner |
| Arc-specific USDC decimal bug | `USDC_DECIMALS = 6` constant enforced in all math; Tester has specific decimal fuzz tests |

---

## 13. Handoff Checkpoints

Use these as PR gates between agents:

```
[ ] Architect  → Implementer : This AGENTS.md is finalized and signed off
[ ] Implementer → Tester     : All contracts compile, natdoc complete, deploy script runs on fork
[ ] Tester     → Reviewer    : Coverage ≥90%, all scenarios pass, fuzz 10k+ runs green
[ ] Reviewer   → Merge       : No HIGH/CRITICAL findings; gas report reviewed; AGENTS.md updated if spec changed
```

---

*Last updated: 2026-08-31 | Owner: Architect agent | Version: 1.0.0*
