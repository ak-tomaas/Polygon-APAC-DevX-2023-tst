require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

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
      gasPrice: 1000000000,
      accounts:
        [
          process.env.DEPLOYER_PRIVATE_KEY,
          process.env.VEHICLE_OWNER_PRIVATE_KEY,
          process.env.SERVICE_PROVIDER_PRIVATE_KEY,
        ]
    },
    testnet_aurora: {
      url: 'https://aurora-testnet.infura.io/v3/1f0c9eca3f6f4e27ab3531c5c86ff490',
      chainId: 1313161555,
      accounts: [
          process.env.DEPLOYER_PRIVATE_KEY,
          process.env.VEHICLE_OWNER_PRIVATE_KEY,
          process.env.SERVICE_PROVIDER_PRIVATE_KEY,
        ],
    }
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
