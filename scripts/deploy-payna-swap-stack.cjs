const hre = require("hardhat");

const DEFAULTS = {
  dexRouter: "0x4d306D129C52E88a7766dc3d70ce28d423E3b1Ef",
  dexFactory: "0xdE6b2AEf32FE1e675060dBC47BC2dF049052494E",
  usdc: "0x3600000000000000000000000000000000000000",
  eurc: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  cirbtc: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF",
};

function envAddress(name, fallback) {
  return process.env[name] || fallback;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const initialRecorder = process.env.RA_RECEIPT_RECORDER_ADDRESS || deployer.address;
  const owner = process.env.PAYNA_SWAP_OWNER_ADDRESS || deployer.address;
  const dexRouter = envAddress("PAYNA_DEX_ROUTER", DEFAULTS.dexRouter);
  const dexFactory = envAddress("PAYNA_DEX_FACTORY", DEFAULTS.dexFactory);
  const usdc = envAddress("PAYNA_TOKEN_USDC", DEFAULTS.usdc);
  const eurc = envAddress("PAYNA_TOKEN_EURC", DEFAULTS.eurc);
  const cirbtc = envAddress("PAYNA_TOKEN_CIRBTC", DEFAULTS.cirbtc);

  console.log("Deploying Payna swap stack");
  console.log("Network:", network.chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log("Owner:", owner);
  console.log("Initial recorder:", initialRecorder);
  console.log("DEX router:", dexRouter);
  console.log("DEX factory:", dexFactory);

  const Registry = await hre.ethers.getContractFactory("RaReceiptRegistryV2");
  const registry = await Registry.deploy(initialRecorder);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  const registryTx = registry.deploymentTransaction();

  const Adapter = await hre.ethers.getContractFactory("PaynaSwapAdapter");
  const adapter = await Adapter.deploy(dexRouter, dexFactory, usdc, eurc, cirbtc, owner);
  await adapter.waitForDeployment();
  const adapterAddress = await adapter.getAddress();
  const adapterTx = adapter.deploymentTransaction();

  console.log("RaReceiptRegistryV2:", registryAddress);
  console.log("RaReceiptRegistryV2 deployment tx:", registryTx?.hash ?? "unknown");
  console.log("PaynaSwapAdapter:", adapterAddress);
  console.log("PaynaSwapAdapter deployment tx:", adapterTx?.hash ?? "unknown");
  console.log("");
  console.log("Env:");
  console.log(`RA_RECEIPT_REGISTRY_V2_ADDRESS=${registryAddress}`);
  console.log(`NEXT_PUBLIC_RA_RECEIPT_REGISTRY_V2_ADDRESS=${registryAddress}`);
  console.log(`PAYNA_SWAP_ADAPTER_ADDRESS=${adapterAddress}`);
  console.log(`NEXT_PUBLIC_PAYNA_SWAP_ADAPTER_ADDRESS=${adapterAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
