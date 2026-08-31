import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const ARC_CHAIN_ID = 5042002;

export const arcTestnet = {
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL || "https://rpc.testnet.arc.io"] } },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.testnet.arc.io" },
  },
  testnet: true,
} as const;

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export function getOracleWalletClient() {
  const pk = process.env.ORACLE_SIGNER_PK;
  if (!pk) throw new Error("ORACLE_SIGNER_PK not set");
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({ account, chain: arcTestnet, transport: http() });
}

export const CREDIT_SCORE_REGISTRY_ABI = [
  { name: "getScore", type: "function", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint16" }] },
  { name: "getProfile", type: "function", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "tuple", components: [
    { name: "score", type: "uint16" },
    { name: "lastUpdated", type: "uint32" },
    { name: "totalLoans", type: "uint32" },
    { name: "repaidLoans", type: "uint32" },
    { name: "defaultedLoans", type: "uint32" },
    { name: "totalVolumeUSDC", type: "uint96" },
    { name: "arcPassVerified", type: "bool" },
  ] }] },
  { name: "initProfile", type: "function", stateMutability: "nonpayable", inputs: [{ name: "borrower", type: "address" }], outputs: [] },
  { name: "setScore", type: "function", stateMutability: "nonpayable", inputs: [{ name: "borrower", type: "address" }, { name: "score", type: "uint16" }, { name: "verified", type: "bool" }], outputs: [] },
  { name: "slashScore", type: "function", stateMutability: "nonpayable", inputs: [{ name: "borrower", type: "address" }, { name: "penalty", type: "uint16" }], outputs: [] },
] as const;

export const LOAN_VAULT_ABI = [
  { name: "requestLoan", type: "function", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }, { name: "termDays", type: "uint8" }], outputs: [{ type: "uint256" }] },
  { name: "repay", type: "function", stateMutability: "nonpayable", inputs: [{ name: "loanId", type: "uint256" }], outputs: [] },
  { name: "getLoan", type: "function", stateMutability: "view", inputs: [{ name: "loanId", type: "uint256" }], outputs: [{ type: "tuple", components: [
    { name: "borrower", type: "address" },
    { name: "principal", type: "uint256" },
    { name: "interest", type: "uint256" },
    { name: "dueTimestamp", type: "uint256" },
    { name: "termDays", type: "uint8" },
    { name: "status", type: "uint8" },
  ] }] },
  { name: "totalDeposited", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "totalLent", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "activeLoanId", type: "function", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export const CREDIT_LINE_ABI = [
  { name: "getCreditLimit", type: "function", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "getAvailableCredit", type: "function", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "getInterestRate", type: "function", stateMutability: "view", inputs: [{ name: "borrower", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "refreshCredit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "borrower", type: "address" }], outputs: [] },
  { name: "creditLimit", type: "function", stateMutability: "view", inputs: [{ name: "arg0", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "availableCredit", type: "function", stateMutability: "view", inputs: [{ name: "arg0", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export const TRANCHE_MANAGER_ABI = [
  { name: "deposit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "lender", type: "address" }, { name: "amount", type: "uint256" }, { name: "tranche", type: "uint8" }], outputs: [] },
  { name: "withdraw", type: "function", stateMutability: "nonpayable", inputs: [{ name: "lender", type: "address" }, { name: "shares", type: "uint256" }, { name: "tranche", type: "uint8" }], outputs: [] },
  { name: "getShares", type: "function", stateMutability: "view", inputs: [{ name: "lender", type: "address" }, { name: "tranche", type: "uint8" }], outputs: [{ type: "uint256" }] },
  { name: "getTotalShares", type: "function", stateMutability: "view", inputs: [{ name: "tranche", type: "uint8" }], outputs: [{ type: "uint256" }] },
] as const;

export const SCORE_ORACLE_ABI = [
  { name: "requestScoreUpdate", type: "function", stateMutability: "nonpayable", inputs: [{ name: "borrower", type: "address" }], outputs: [] },
  { name: "fulfillScoreUpdate", type: "function", stateMutability: "nonpayable", inputs: [
    { name: "borrower", type: "address" },
    { name: "arcPassKycScore", type: "uint16" },
    { name: "arcPassRepScore", type: "uint16" },
    { name: "repaymentRaw", type: "uint32" },
    { name: "usdcThroughput90d", type: "uint96" },
    { name: "walletAgeDays", type: "uint32" },
    { name: "arcPassVerified", type: "bool" },
  ], outputs: [] },
  { name: "trustedBackend", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
] as const;

export const REPAYMENT_SCHEDULER_ABI = [
  { name: "checkAndMarkDefault", type: "function", stateMutability: "nonpayable", inputs: [{ name: "loanId", type: "uint256" }], outputs: [] },
] as const;

export const ARCPASS_ABI = [
  { name: "isKYCVerified", type: "function", stateMutability: "view", inputs: [{ name: "subject", type: "address" }], outputs: [{ type: "bool" }] },
  { name: "getReputationScore", type: "function", stateMutability: "view", inputs: [{ name: "subject", type: "address" }], outputs: [
    { name: "score", type: "uint16" },
    { name: "updatedAt", type: "uint32" },
  ] },
  { name: "getAttestation", type: "function", stateMutability: "view", inputs: [{ name: "subject", type: "address" }, { name: "schemaId", type: "bytes32" }], outputs: [{ type: "tuple", components: [
    { name: "subject", type: "address" },
    { name: "schemaId", type: "bytes32" },
    { name: "issuedAt", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
    { name: "data", type: "bytes" },
  ] }] },
] as const;
