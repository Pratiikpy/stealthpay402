require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config();

const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x" + "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || "";
const POLYGONSCAN_KEY = process.env.POLYGONSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: false,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    polygonAmoy: {
      url: "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: [DEPLOYER_KEY],
      gasPrice: 30000000000,
    },
    polygonMainnet: {
      url: ALCHEMY_KEY
        ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
        : "https://polygon-rpc.com",
      chainId: 137,
      accounts: [DEPLOYER_KEY],
    },
    zkevmCardona: {
      url: "https://rpc.cardona.zkevm-rpc.com",
      chainId: 2442,
      accounts: [DEPLOYER_KEY],
    },
  },
  etherscan: {
    apiKey: POLYGONSCAN_KEY,
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
