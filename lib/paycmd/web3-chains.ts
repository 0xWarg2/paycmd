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
    hexChainId: "0x4cef52",
    name: "Arc Testnet",
    rpcUrl: `https://rpc.testnet.arc.network/${arcRpcKey}`,
    blockExplorerUrl: "https://testnet.arcscan.app",
    nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
    usdcAddress: "0x3600000000000000000000000000000000000000",
  },
  arbitrumSepolia: {
    id: 421614,
    hexChainId: "0x66eee",
    name: "Arbitrum Sepolia",
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    blockExplorerUrl: "https://sepolia.arbiscan.io",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
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
  sepolia: {
    id: 11155111,
    hexChainId: "0xaa36a7",
    name: "Ethereum Sepolia",
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    blockExplorerUrl: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
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
  hyperEvmTestnet: {
    id: 998,
    hexChainId: "0x3e6",
    name: "HyperEVM Testnet",
    rpcUrl: "https://rpc.hyperliquid-testnet.xyz/evm",
    blockExplorerUrl: "https://app.hyperliquid-testnet.xyz/explorer",
    nativeCurrency: { name: "Hype", symbol: "HYPE", decimals: 18 },
    usdcAddress: "0x2B3370eE501B4a559b57D449569354196457D8Ab",
  },
  optimismSepolia: {
    id: 11155420,
    hexChainId: "0xaa37dc",
    name: "OP Sepolia",
    rpcUrl: "https://sepolia.optimism.io",
    blockExplorerUrl: "https://sepolia-optimism.etherscan.io",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
  },
  polygonAmoy: {
    id: 80002,
    hexChainId: "0x13882",
    name: "Polygon Amoy",
    rpcUrl: "https://rpc-amoy.polygon.technology",
    blockExplorerUrl: "https://amoy.polygonscan.com",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  },
  seiAtlantic: {
    id: 1328,
    hexChainId: "0x530",
    name: "Sei Atlantic",
    rpcUrl: "https://evm-rpc-testnet.sei-apis.com",
    blockExplorerUrl: "https://seitrace.com",
    nativeCurrency: { name: "Sei", symbol: "SEI", decimals: 18 },
    usdcAddress: "0x4fCF1784B31630811181f670Aea7A7bEF803eaED",
  },
  sonicTestnet: {
    id: 14601,
    hexChainId: "0x3909",
    name: "Sonic Testnet",
    rpcUrl: "https://rpc.testnet.soniclabs.com",
    blockExplorerUrl: "https://testnet.sonicscan.org",
    nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
    usdcAddress: "0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51",
  },
  unichainSepolia: {
    id: 1301,
    hexChainId: "0x515",
    name: "Unichain Sepolia",
    rpcUrl: "https://sepolia.unichain.org",
    blockExplorerUrl: "https://sepolia.uniscan.xyz",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: "0x31d0220469e10c4E71834a79b1f276d740d3768F",
  },
  worldChainSepolia: {
    id: 4801,
    hexChainId: "0x12c1",
    name: "World Chain Sepolia",
    rpcUrl: "https://worldchain-sepolia.gateway.tenderly.co",
    blockExplorerUrl: "https://sepolia.worldscan.org",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88",
  },
};
