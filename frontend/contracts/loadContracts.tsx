
import ERC20MockJSON_sepolia from "./sepolia/ERC20Mock.json";
import TRNJSON_sepolia from "./sepolia/TomaasRWN.json";
import TLNJSON_sepolia from "./sepolia/TomaasLPN.json";
import LendingJSON_sepolia from "./sepolia/TomaasLending.json";
import MarketplaceJSON_sepolia from "./sepolia/TomaasMarketplace.json";
import StakingJSON_sepolia from "./sepolia/TomaasStaking.json";
import ContractAddressJSON_sepolia from "./sepolia/contract-address.json";

import ERC20MockJSON_localhost from "../contracts/localhost/ERC20Mock.json";
import TRNJSON_localhost from "./localhost/TomaasRWN.json";
import TLNJSON_localhost from "./localhost/TomaasLPN.json";
import LendingJSON_localhost from "./localhost/TomaasLending.json";
import MarketplaceJSON_localhost from "./localhost/TomaasMarketplace.json";
import StakingJSON_localhost from "./localhost/TomaasStaking.json";
import ContractAddressJSON_localhost from "./localhost/contract-address.json";

import ERC20MockJSON_polygon from "./polygon/ERC20Mock.json";
import TRNJSON_polygon from "./polygon/TomaasRWN.json";
import TLNJSON_polygon from "./polygon/TomaasLPN.json";
import LendingJSON_polygon from "./polygon/TomaasLending.json";
import MarketplaceJSON_polygon from "./polygon/TomaasMarketplace.json";
import StakingJSON_polygon from "./polygon/TomaasStaking.json";
import ContractAddressJSON_polygon from "./polygon/contract-address.json";

import ERC20MockJSON_arbitrumGoerli from "./arbitrumGoerli/ERC20Mock.json";
import TRNJSON_arbitrumGoerli from "./arbitrumGoerli/TomaasRWN.json";
import TLNJSON_arbitrumGoerli from "./arbitrumGoerli/TomaasLPN.json";
import LendingJSON_arbitrumGoerli from "./arbitrumGoerli/TomaasLending.json";
import MarketplaceJSON_arbitrumGoerli from "./arbitrumGoerli/TomaasMarketplace.json";
import StakingJSON_arbitrumGoerli from "./arbitrumGoerli/TomaasStaking.json";
import ContractAddressJSON_arbitrumGoerli from "./arbitrumGoerli/contract-address.json";

interface JSONData {
  [key: string]: any;
}

let ERC20MockJSON: JSONData;
let TRNJSON: JSONData;
let TLNJSON: JSONData;
let LendingJSON: JSONData;
let MarketplaceJSON: JSONData;
let StakingJSON: JSONData;
let ContractAddressJSON: JSONData;

console.log("REACT_APP_NETWORK : ", process.env.REACT_APP_NETWORK);

if (process.env.REACT_APP_NETWORK === "sepolia") {
  ERC20MockJSON = ERC20MockJSON_sepolia;
  TRNJSON = TRNJSON_sepolia;
  TLNJSON = TLNJSON_sepolia;
  LendingJSON = LendingJSON_sepolia;
  MarketplaceJSON = MarketplaceJSON_sepolia;
  StakingJSON = StakingJSON_sepolia;
  ContractAddressJSON = ContractAddressJSON_sepolia; 
}
else if (process.env.REACT_APP_NETWORK === "arbitrumGoerli") {
  ERC20MockJSON = ERC20MockJSON_arbitrumGoerli;
  TRNJSON = TRNJSON_arbitrumGoerli;
  TLNJSON = TLNJSON_arbitrumGoerli;
  LendingJSON = LendingJSON_arbitrumGoerli;
  MarketplaceJSON = MarketplaceJSON_arbitrumGoerli;
  StakingJSON = StakingJSON_arbitrumGoerli;
  ContractAddressJSON = ContractAddressJSON_arbitrumGoerli;
}
else if (process.env.REACT_APP_NETWORK === "polygon") {
  ERC20MockJSON = ERC20MockJSON_polygon;
  TRNJSON = TRNJSON_polygon;
  TLNJSON = TLNJSON_polygon;
  LendingJSON = LendingJSON_polygon;
  MarketplaceJSON = MarketplaceJSON_polygon;
  StakingJSON = StakingJSON_polygon;
  ContractAddressJSON = ContractAddressJSON_polygon;
}
else if (process.env.REACT_APP_NETWORK === "localhost") {
  ERC20MockJSON = ERC20MockJSON_localhost;
  TRNJSON = TRNJSON_localhost;
  TLNJSON = TLNJSON_localhost;
  LendingJSON = LendingJSON_localhost;
  MarketplaceJSON = MarketplaceJSON_localhost;
  StakingJSON = StakingJSON_localhost;
  ContractAddressJSON = ContractAddressJSON_localhost;
}

export {
  ERC20MockJSON,
  TRNJSON,
  TLNJSON,
  LendingJSON,
  MarketplaceJSON,
  StakingJSON,
  ContractAddressJSON
};
