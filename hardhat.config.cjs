require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");

const arcRpcKey =
  process.env.ARC_TESTNET_RPC_KEY ||
  process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_KEY ||
  "c0ca2582063a5bbd5db2f98c139775e982b16919";

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
      url: `https://rpc.testnet.arc.network/${arcRpcKey}`,
      chainId: 5042002,
      accounts: relayerPrivateKey ? [relayerPrivateKey] : [],
    },
  },
};
