const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const initialRecorder = process.env.RA_RECEIPT_RECORDER_ADDRESS || deployer.address;
  const network = await hre.ethers.provider.getNetwork();

  console.log("Deploying RaReceiptRegistry");
  console.log("Network:", network.chainId.toString());
  console.log("Deployer:", deployer.address);
  console.log("Initial recorder:", initialRecorder);

  const Registry = await hre.ethers.getContractFactory("RaReceiptRegistry");
  const registry = await Registry.deploy(initialRecorder);
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  const deploymentTx = registry.deploymentTransaction();

  console.log("RaReceiptRegistry:", address);
  console.log("Deployment tx:", deploymentTx?.hash ?? "unknown");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
