import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";
import "@typechain/hardhat";
import "hardhat-deploy";
import "@fhevm/hardhat-plugin";
import * as dotenv from "dotenv";

dotenv.config();

const normalizePrivateKey = (key?: string) => {
  if (!key) {
    return undefined;
  }
  const trimmed = key.trim();
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return /^0x[0-9a-fA-F]{64}$/.test(withPrefix) ? withPrefix : undefined;
};

const sepoliaPrivateKey = normalizePrivateKey(process.env.PRIVATE_KEY);

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
      accounts: sepoliaPrivateKey ? [sepoliaPrivateKey] : [],
      chainId: 11155111,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy",
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
