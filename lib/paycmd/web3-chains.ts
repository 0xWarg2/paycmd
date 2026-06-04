import { type PayCmdChain } from "@/lib/paycmd/chains";

export type PayCmdWeb3Chain = {
  id: number;
  hexChainId: `0x${string}`;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  usdcAddress: `0x${string}`;
};

const arcRpcKey = process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_KEY || "c0ca2582063a5bbd5db2f98c139775e982b16919";

export const web3Chains: Record<PayCmdChain, PayCmdWeb3Chain> = {
  arcTestnet: {
    id: 5042002,
    hexChainId: "0x4cf1d2",
    name: "Arc Testnet",
    rpcUrl: `https://rpc.testnet.arc.network/${arcRpcKey}`,
    blockExplorerUrl: "https://explorer.arc.testnet.circle.com",
    nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
    usdcAddress: "0x3600000000000000000000000000000000000000",
  },
  baseSepolia: {
    id: 84532,
    hexChainId: "0x14a34",
    name: "Base Sepolia",
    rpcUrl: "https://sepolia.base.org",
    blockExplorerUrl: "https://sepolia.basescan.org",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  avalancheFuji: {
    id: 43113,
    hexChainId: "0xa869",
    name: "Avalanche Fuji",
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    blockExplorerUrl: "https://testnet.snowtrace.io",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    usdcAddress: "0x5425890298aed601595a70ab815c96711a31bc65",
  },
};
