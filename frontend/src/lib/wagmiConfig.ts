import { http, createConfig } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.testnet.arc.io" },
  },
  testnet: true,
});

const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;

const connectors: any[] = [injected()];
if (wcProjectId && wcProjectId.length > 10) {
  connectors.push(walletConnect({ projectId: wcProjectId, showQrModal: true }));
}

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connectors: connectors as any,
  transports: {
    [arcTestnet.id]: http("https://rpc.testnet.arc.io"),
  },
});
