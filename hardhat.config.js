require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
require('@openzeppelin/hardhat-upgrades');

const AURORA_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 1337,
      allowUnlimitedContractSize: false,
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    },
    sepolia: {
      url:process.env.ALCHEMY_SEPOLIA_API_URL,
      accounts:
        [
          process.env.DEPLOYER_PRIVATE_KEY,
          process.env.VEHICLE_OWNER_PRIVATE_KEY,
          process.env.SERVICE_PROVIDER_PRIVATE_KEY,
        ]
    },
  },
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
