const hre = require("hardhat");

require('dotenv').config();
const path = require("path");

const TRN_METADATA_URL = require("../data/tomaas-meta-url.json").trnUrl;
const TLN_METADATA_URL = require("../data/tomaas-meta-url.json").tlnUrl;

const FLO_SSD = new Date("2020-11-20").getTime() / 1000;
const FLO_RENTAL_EXPIRE = new Date("2024-11-19").getTime() / 1000;
const FLO_USEFUL_LIFE = 4;
// const FLO_PRICE = "770";
const FLO_RWA_AMOUNT = 1600;
const FLO_REVENEUE_SHARE_RATIO = 4000; // 40%

const TRN_MINT_AMOUNT = 3; // 16 * 100
const TRN_FOR_SALES = 1; // 4 * 100
const TRN_SELL_TO_POOL = 1; // 12 * 100
const QUANTITY_AT_ONCE = 10; //100

//const TRN_PRICE = "100";

let USDC_100;
let USDC_300;
let USDC_770;
let USDC_100K;

async function waitForEvent(contract, eventString) {
  const eventDetails = await new Promise((resolve, reject) => {
    contract.once(eventString, (detail1, detail2, event) => { // replace `detail1, detail2` with the actual parameters that your event emits
      try {
        // You can add any additional processing here
        // console.log(`Block number: ${event.blockNumber}, Detail 1: ${detail1}, Detail 2: ${detail2}`);
        resolve({ detail1, detail2, event });
      } catch (error) {
        reject(error);
      }
    });
  });

  console.log(`${eventString} Event caught. Block number: ${eventDetails.event.blockNumber}, Detail 1: ${eventDetails.detail1}, Detail 2: ${eventDetails.detail2}`);
}

async function main() {
  if (network.name === "hardhat") {
    console.warn(
      "You are trying to deploy a contract to the Hardhat Network, which" +
        "gets automatically created and destroyed every time. Use the Hardhat" +
        " option '--network localhost'"
    );
  }

  const [deployer, vehicleOwner, serviceProvider] = await ethers.getSigners();

  console.log(
    "Deploying the contracts with the account:",
    await deployer.getAddress()
  );

  console.log("Account balance:", (await deployer.getBalance()).toString());

  voAddress = await vehicleOwner.getAddress();
  console.log("vehicleOwner address:", voAddress);

  spAddress = await serviceProvider.getAddress();
  console.log("serviceProvider address:", spAddress);

  //deploy USDC for tomaas testing
  const USDC = await hre.ethers.getContractFactory("ERC20Mock");
  let usdc = await upgrades.deployProxy(USDC, ["USD Coin", "USDC"]);
  await usdc.deployed();
  console.log("USDC address:", usdc.address);

  let decimals = await usdc.decimals();

  USDC_100 = ethers.utils.parseUnits("100", decimals);
  USDC_300 = ethers.utils.parseUnits("300", decimals);
  USDC_770 = ethers.utils.parseUnits("770", decimals);
  USDC_100K = ethers.utils.parseUnits("100000", decimals);

  usdc.mint(deployer.address, USDC_100K);

  const TomaasRWN = await hre.ethers.getContractFactory("TomaasRWN");

  const COLLECTION_NAME_1 = "TRN FLO #1";

  const trnFlo1 = await upgrades.deployProxy(TomaasRWN, 
                              [ COLLECTION_NAME_1, 
                                usdc.address, 
                                FLO_SSD, 
                                FLO_USEFUL_LIFE, 
                                USDC_770]);
  await trnFlo1.deployed();
  console.log("TRN FLO #1 address:", trnFlo1.address);

  for (let i = 0; i < TRN_MINT_AMOUNT; i++) {
    await trnFlo1.safeMintMultipleAndSetUser(voAddress,
      TRN_METADATA_URL,
      QUANTITY_AT_ONCE,
      spAddress,
      FLO_RENTAL_EXPIRE);
    await waitForEvent(trnFlo1, "UpdateUsers");
    console.log("TRN FLO #1 supply:", (await trnFlo1.totalSupply()).toString());
  }

  const TomaasLending = await hre.ethers.getContractFactory("TomaasLending");
  const tomaasLending = await upgrades.deployProxy(TomaasLending);
  await tomaasLending.deployed();
  console.log("TomaasLending address:", tomaasLending.address);

  await trnFlo1.transferOwnership(tomaasLending.address);
  await tomaasLending.addCollection(trnFlo1.address, FLO_REVENEUE_SHARE_RATIO);
  await tomaasLending.registerRenter(trnFlo1.address, spAddress);

  const TomaasMarketplace = await hre.ethers.getContractFactory("TomaasMarketplace");
  const tomaasMarketplace = await upgrades.deployProxy(TomaasMarketplace, [tomaasLending.address]);
  await tomaasMarketplace.deployed();
  console.log("TomaasMarketplace address:", tomaasMarketplace.address);


  //set approval for all
  await trnFlo1.connect(vehicleOwner).setApprovalForAll(tomaasMarketplace.address, true);

  // add sales info of 400 TRNs to marketplace
  for (let i=0; i<TRN_FOR_SALES;i++) {
    let tokenIds = [];
    for (let j=0; j<QUANTITY_AT_ONCE; j++) {
      tokenIds.push(i*QUANTITY_AT_ONCE+j);
    }
    await tomaasMarketplace.connect(vehicleOwner).listingMultipleForSale(trnFlo1.address, USDC_300, tokenIds);
    await waitForEvent(tomaasMarketplace, "NFTsListedForSale");
    console.log("TRN FLO #1 saleInfos:", (await tomaasMarketplace.getListedNFTs(trnFlo1.address)).length);
  }

  let saleInfos = await tomaasMarketplace.getListedNFTs(trnFlo1.address);
  console.log("saleInfos of marketplace: ", saleInfos.length);

  const TomaasLPN = await hre.ethers.getContractFactory("TomaasLPN");
  const tomaasLPN = await upgrades.deployProxy(TomaasLPN, [usdc.address, USDC_100]);
  await tomaasLPN.deployed();
  console.log("Tomaas LPN address:", tomaasLPN.address);

  await usdc.approve(tomaasLPN.address, USDC_100.mul(10));
  await tomaasLPN.safeMintMultiple(deployer.address, TLN_METADATA_URL, 10);
  console.log("Tomaas LPN supply:", (await tomaasLPN.totalSupply()).toString());

  const TomaasSP = await hre.ethers.getContractFactory("TomaasStaking");
  const tomaasStaking = await upgrades.deployProxy(TomaasSP, []);
  await tomaasStaking.deployed();
  console.log("Tomaas Staking address:", tomaasStaking.address);

  await tomaasStaking.connect(deployer).addTRNAddress(trnFlo1.address, usdc.address, FLO_REVENEUE_SHARE_RATIO);
  console.log("Tomaas Staking add TRN Address");

  let rates = [100, 500, 550, 600, 700, 800, 950, 1100, 1300, 1500, 1800];
  await tomaasStaking.connect(deployer).addTLNAddress(tomaasLPN.address, usdc.address, USDC_100, rates);
  console.log("Tomaas Staking add TLN Address");
  await tomaasLPN.connect(deployer).addToWL(tomaasStaking.address);
  console.log("Tomass LPN add staking address to white list");
  await tomaasStaking.connect(deployer).setPriceOfTRN(trnFlo1.address, USDC_300);
  console.log("tomass LPN set price of TRN");

  await trnFlo1.connect(vehicleOwner).setApprovalForAll(tomaasStaking.address, true);
  for (let i = TRN_FOR_SALES; i < TRN_FOR_SALES+TRN_SELL_TO_POOL; i++) {
    let tokenIds = [];
    for (let j = 0; j < QUANTITY_AT_ONCE; j++) {
      tokenIds.push(i * QUANTITY_AT_ONCE + j);
    }
    await tomaasStaking.connect(vehicleOwner).sellTRNsToPool(trnFlo1.address, tokenIds);
    await waitForEvent(tomaasStaking, "SellTRNsToPool");

    let lengthToPurchase = await tomaasStaking.connect(vehicleOwner).
                                lengthOfTRNsToPurchase(trnFlo1.address);
    console.log("length of TRNs to purchase: ", 
                                lengthToPurchase.toString());
  }

  await tomaasLPN.connect(deployer).setApprovalForAll(tomaasStaking.address, true);
  //stake 4 TRNs of 10 TRNs 
  let tokenIds = [0, 1, 2, 3]
  await tomaasStaking.connect(deployer).stakeTLNs(tomaasLPN.address, tokenIds);
  let totalStaked = await tomaasStaking.connect(deployer).totalStakedTokens();
  console.log("total staked tokens: ", totalStaked.toString());

  // saveFrontendFiles(usdc, trnFlo1, tomaasLending, tomaasMarketplace, tomaasLPN, tomaasStaking); 
}

function saveFrontendFiles(usdc, tomaasRWN, tomaasLending, tomaasMarketplace, tomaasLPN, tomaasSP) {
  const fs = require("fs");
  const contractsDir = path.join(__dirname, "../frontend/contracts/"+network.name);

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir);
  }

  fs.writeFileSync(
    path.join(contractsDir, "contract-address.json"),
    JSON.stringify({ 
      USDC: usdc.address,
      TomaasRWN: tomaasRWN.address, 
      TomaasLending: tomaasLending.address, 
      TomaasMarketplace: tomaasMarketplace.address,
      TomaasLPN: tomaasLPN.address,
      TomaasStaking: tomaasSP.address
    }, undefined, 2));

  const TomaasNFArtifact = artifacts.readArtifactSync("TomaasRWN");
  fs.writeFileSync(
    path.join(contractsDir, "TomaasRWN.json"),
    JSON.stringify(TomaasNFArtifact, null, 2)
  );

  const TomaasLendingArtifact = artifacts.readArtifactSync("TomaasLending");
  fs.writeFileSync(
    path.join(contractsDir, "TomaasLending.json"),
    JSON.stringify(TomaasLendingArtifact, null, 2)
  );

  const TomaasMarketplaceArtifact = artifacts.readArtifactSync("TomaasMarketplace");
  fs.writeFileSync(
    path.join(contractsDir, "TomaasMarketplace.json"),
    JSON.stringify(TomaasMarketplaceArtifact, null, 2)
  );

  const TomaasLPNArtifact = artifacts.readArtifactSync("TomaasLPN");
  fs.writeFileSync(
    path.join(contractsDir, "TomaasLPN.json"),
    JSON.stringify(TomaasLPNArtifact, null, 2)
  );

  const TomaasSPArtifact = artifacts.readArtifactSync("TomaasStaking");
  fs.writeFileSync(
    path.join(contractsDir, "TomaasStaking.json"),
    JSON.stringify(TomaasSPArtifact, null, 2)
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });