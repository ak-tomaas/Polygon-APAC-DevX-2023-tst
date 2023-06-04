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
      accounts: [
        process.env.DEPLOYER_PRIVATE_KEY,
        process.env.VEHICLE_OWNER_PRIVATE_KEY,
        process.env.SERVICE_PROVIDER_PRIVATE_KEY,
      ],
    },
    polygon: {
      url: process.env.ALCHEMY_POLYGON_API_URL,
      chainid: 137,
      accounts: [
        process.env.DEPLOYER_PRIVATE_KEY,
        process.env.VEHICLE_OWNER_PRIVATE_KEY,
        process.env.SERVICE_PROVIDER_PRIVATE_KEY,
      ],
    },
    polygon_mumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      chainid: 80001,
      accounts: [
        process.env.DEPLOYER_PRIVATE_KEY,
        process.env.VEHICLE_OWNER_PRIVATE_KEY,
        process.env.SERVICE_PROVIDER_PRIVATE_KEY,
      ],
    }
  },
  etherscan: {
    customChains: [
      {
        network: "polygon_mumbai",
        chainId: 80001,
        apiKey: process.env.POLYGONSCAN_API_KEY
      },
      {
        network: "polygon",
        chainId: 137,
        apiKey: process.env.POLYGONSCAN_API_KEY
      }
    ]
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
