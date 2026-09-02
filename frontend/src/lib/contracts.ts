export const CONTRACTS = {
  creditScoreRegistry: import.meta.env.VITE_CREDIT_SCORE_REGISTRY as `0x${string}`,
  creditLine: import.meta.env.VITE_CREDIT_LINE as `0x${string}`,
  loanVault: import.meta.env.VITE_LOAN_VAULT as `0x${string}`,
  trancheManager: import.meta.env.VITE_TRANCHE_MANAGER as `0x${string}`,
  usdc: import.meta.env.VITE_USDC_ADDRESS as `0x${string}`,
} as const;

export const USDC_DECIMALS = 6;

export const CREDIT_TIERS = [
  { min: 0, max: 299, label: "No Access", limit: 0, apr: 0 },
  { min: 300, max: 499, label: "Starter", limit: 50, apr: 24 },
  { min: 500, max: 649, label: "Bronze", limit: 250, apr: 18 },
  { min: 650, max: 799, label: "Silver", limit: 1000, apr: 14 },
  { min: 800, max: 899, label: "Gold", limit: 5000, apr: 10 },
  { min: 900, max: 1000, label: "Platinum", limit: 20000, apr: 7 },
] as const;

export function getTier(score: number) {
  return CREDIT_TIERS.find((t) => score >= t.min && score <= t.max) ?? CREDIT_TIERS[0];
}
