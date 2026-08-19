require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

const arcRpcUrl = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.io";

const relayerPrivateKey = process.env.RA_RECEIPT_RELAYER_PRIVATE_KEY;

/** @type import("hardhat/config").HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    arcTestnet: {
      url: arcRpcUrl,
      chainId: 5042002,
      accounts: relayerPrivateKey ? [relayerPrivateKey] : [],
    },
  },
};
