// src/config/appkit.ts
import { createAppKit }       from "@reown/appkit/react";
import { Ethers5Adapter }     from "@reown/appkit-adapter-ethers5";
import type { AppKitNetwork } from "@reown/appkit/networks";

export const liskSepolia: AppKitNetwork = {
  id: 4202,
  name: "Lisk Sepolia Testnet",
  chainNamespace: "eip155",
  caipNetworkId: "eip155:4202",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.sepolia-api.lisk.com"] } },
  blockExplorers: { default: { name: "Lisk Explorer", url: "https://sepolia-explorer.lisk.com" } },
  testnet: true,
};

// Get a free projectId at https://cloud.reown.com
// Then add VITE_REOWN_PROJECT_ID=your_id to your .env file
const PROJECT_ID = import.meta.env.VITE_REOWN_PROJECT_ID as string;

createAppKit({
  adapters: [new Ethers5Adapter()],
  networks: [liskSepolia],
  defaultNetwork: liskSepolia,
  projectId: PROJECT_ID,
  metadata: {
    name: "CaesarCoin Faucet",
    description: "Request free CaesarCoin tokens on Lisk Sepolia",
    url: "http://localhost:5173",
    icons: ["https://avatars.githubusercontent.com/u/179229932"],
  },
  features: { analytics: false, email: false, socials: false, onramp: false, swaps: false },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#7c3aed",
    "--w3m-border-radius-master": "2px",
  },
});