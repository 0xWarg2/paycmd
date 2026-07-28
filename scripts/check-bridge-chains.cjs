const { BridgeKit } = require("@circle-fin/bridge-kit");

const expectedChains = [
  ["Arbitrum_Sepolia", 421614, "https://sepolia-rollup.arbitrum.io/rpc"],
  ["Arc_Testnet", 5042002, "https://rpc.testnet.arc.network"],
  ["Avalanche_Fuji", 43113, "https://api.avax-test.network/ext/bc/C/rpc"],
  ["Base_Sepolia", 84532, "https://sepolia.base.org"],
  ["Codex_Testnet", 812242, "https://rpc.codex-stg.xyz"],
  ["Edge_Testnet", 33431, "https://edge-testnet.g.alchemy.com/public"],
  ["Ethereum_Sepolia", 11155111, "https://11155111.rpc.thirdweb.com"],
  ["HyperEVM_Testnet", 998, "https://rpc.hyperliquid-testnet.xyz/evm"],
  ["Ink_Testnet", 763373, "https://rpc-gel-sepolia.inkonchain.com"],
  ["Linea_Sepolia", 59141, "https://rpc.sepolia.linea.build"],
  ["Monad_Testnet", 10143, "https://testnet-rpc.monad.xyz"],
  ["Optimism_Sepolia", 11155420, "https://sepolia.optimism.io"],
  ["Plume_Testnet", 98867, "https://testnet-rpc.plume.org"],
  ["Polygon_Amoy_Testnet", 80002, "https://rpc-amoy.polygon.technology"],
  ["Sei_Testnet", 1328, "https://evm-rpc-testnet.sei-apis.com"],
  ["Sonic_Testnet", 14601, "https://rpc.testnet.soniclabs.com"],
  ["Unichain_Sepolia", 1301, "https://sepolia.unichain.org"],
  ["World_Chain_Sepolia", 4801, "https://worldchain-sepolia.g.alchemy.com/public"],
  ["XDC_Apothem", 51, "https://erpc.apothem.network"],
];

async function rpcChainId(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      signal: controller.signal,
    });
    const body = await response.json();
    return body.result;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const kit = new BridgeKit();
  const supported = new Map(
    kit
      .getSupportedChains()
      .filter((chain) => chain?.isTestnet && chain?.type === "evm" && chain?.cctp?.contracts?.v2)
      .map((chain) => [chain.chain, chain]),
  );

  let failed = false;

  for (const [bridgeKitChain, expectedId, rpcUrl] of expectedChains) {
    const circleChain = supported.get(bridgeKitChain);
    const expectedHex = `0x${expectedId.toString(16)}`;

    if (!circleChain) {
      console.error(`${bridgeKitChain}: missing from BridgeKit`);
      failed = true;
      continue;
    }

    if (circleChain.chainId !== expectedId) {
      console.error(`${bridgeKitChain}: BridgeKit chainId=${circleChain.chainId}, expected=${expectedId}`);
      failed = true;
      continue;
    }

    try {
      const actualHex = await rpcChainId(rpcUrl);
      if (String(actualHex).toLowerCase() !== expectedHex) {
        console.error(`${bridgeKitChain}: RPC chainId=${actualHex}, expected=${expectedHex}`);
        failed = true;
        continue;
      }
      console.log(`${bridgeKitChain}: ok ${expectedId} / ${expectedHex}`);
    } catch (error) {
      console.warn(`${bridgeKitChain}: RPC check skipped (${error.name || "Error"}: ${error.message})`);
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
