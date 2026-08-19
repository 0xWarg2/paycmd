import { type PayCmdChain } from "./chains.ts";
import { primaryRpcUrl } from "./rpc-endpoints.ts";

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

// `rpcUrl` is the first entry of that chain's endpoint list in ./rpc-endpoints.ts, never a URL
// written here. This map and the Gateway module used to declare endpoints separately and drifted:
// Amoy pointed at a host that no longer resolves on this side while the other side had moved off it.
export const web3Chains: Record<PayCmdChain, PayCmdWeb3Chain> = {
  arcTestnet: {
    id: 5042002,
    hexChainId: "0x4cef52",
    name: "Arc Testnet",
    rpcUrl: primaryRpcUrl("arcTestnet"),
    blockExplorerUrl: "https://testnet.arcscan.app",
    // Arc RPC gas balances use 18-decimal base units. ERC-20 USDC below remains 6 decimals.
    nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
    usdcAddress: "0x3600000000000000000000000000000000000000",
  },
  arbitrumSepolia: {
    id: 421614,
    hexChainId: "0x66eee",
    name: "Arbitrum Sepolia",
    rpcUrl: primaryRpcUrl("arbitrumSepolia"),
    blockExplorerUrl: "https://sepolia.arbiscan.io",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  },
  baseSepolia: {
    id: 84532,
    hexChainId: "0x14a34",
    name: "Base Sepolia",
    rpcUrl: primaryRpcUrl("baseSepolia"),
    blockExplorerUrl: "https://sepolia.basescan.org",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  },
  sepolia: {
    id: 11155111,
    hexChainId: "0xaa36a7",
    name: "Ethereum Sepolia",
    rpcUrl: primaryRpcUrl("sepolia"),
    blockExplorerUrl: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  },
  avalancheFuji: {
    id: 43113,
    hexChainId: "0xa869",
    name: "Avalanche Fuji",
    rpcUrl: primaryRpcUrl("avalancheFuji"),
    blockExplorerUrl: "https://testnet.snowtrace.io",
    nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
    // EIP-55 checksummed. This was all-lowercase while GATEWAY_CHAIN_CONFIGS held the
    // checksummed form; now that the Gateway map derives its address from here, the
    // canonical casing has to live here.
    usdcAddress: "0x5425890298aed601595a70AB815c96711a31Bc65",
  },
  hyperEvmTestnet: {
    id: 998,
    hexChainId: "0x3e6",
    name: "HyperEVM Testnet",
    rpcUrl: primaryRpcUrl("hyperEvmTestnet"),
    blockExplorerUrl: "https://app.hyperliquid-testnet.xyz/explorer",
    nativeCurrency: { name: "Hype", symbol: "HYPE", decimals: 18 },
    usdcAddress: "0x2B3370eE501B4a559b57D449569354196457D8Ab",
  },
  optimismSepolia: {
    id: 11155420,
    hexChainId: "0xaa37dc",
    name: "OP Sepolia",
    rpcUrl: primaryRpcUrl("optimismSepolia"),
    blockExplorerUrl: "https://sepolia-optimism.etherscan.io",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
  },
  polygonAmoy: {
    id: 80002,
    hexChainId: "0x13882",
    name: "Polygon Amoy",
    rpcUrl: primaryRpcUrl("polygonAmoy"),
    blockExplorerUrl: "https://amoy.polygonscan.com",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    usdcAddress: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  },
  seiAtlantic: {
    id: 1328,
    hexChainId: "0x530",
    name: "Sei Atlantic",
    rpcUrl: primaryRpcUrl("seiAtlantic"),
    blockExplorerUrl: "https://seitrace.com",
    nativeCurrency: { name: "Sei", symbol: "SEI", decimals: 18 },
    usdcAddress: "0x4fCF1784B31630811181f670Aea7A7bEF803eaED",
  },
  sonicTestnet: {
    id: 14601,
    hexChainId: "0x3909",
    name: "Sonic Testnet",
    rpcUrl: primaryRpcUrl("sonicTestnet"),
    blockExplorerUrl: "https://testnet.sonicscan.org",
    nativeCurrency: { name: "Sonic", symbol: "S", decimals: 18 },
    usdcAddress: "0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51",
  },
  unichainSepolia: {
    id: 1301,
    hexChainId: "0x515",
    name: "Unichain Sepolia",
    rpcUrl: primaryRpcUrl("unichainSepolia"),
    blockExplorerUrl: "https://sepolia.uniscan.xyz",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: "0x31d0220469e10c4E71834a79b1f276d740d3768F",
  },
  worldChainSepolia: {
    id: 4801,
    hexChainId: "0x12c1",
    name: "World Chain Sepolia",
    rpcUrl: primaryRpcUrl("worldChainSepolia"),
    blockExplorerUrl: "https://sepolia.worldscan.org",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: "0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88",
  },
};

/**
 * Chain id → PayCmd key. Needed where a caller only has a viem chain object, such as the wagmi
 * transport map, which mixes these chains with bridge-only ones that have no PayCmd key at all.
 */
export function payCmdChainByChainId(chainId: number): PayCmdChain | undefined {
  return (Object.keys(web3Chains) as PayCmdChain[]).find((chain) => web3Chains[chain].id === chainId);
}
