/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_CREDIT_SCORE_REGISTRY: string;
  readonly VITE_CREDIT_LINE: string;
  readonly VITE_LOAN_VAULT: string;
  readonly VITE_TRANCHE_MANAGER: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
