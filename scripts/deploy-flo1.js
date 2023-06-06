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

// const TRN_MINT_AMOUNT = 16; // 16 * 100
// const TRN_FOR_SALES = 4; // 4 * 100
// const TRN_SELL_TO_POOL = 12; // 12 * 100
// const QUANTITY_AT_ONCE = 100; //100

const TRN_MINT_AMOUNT = 2; // 16 * 100
const TRN_FOR_SALES = 1; // 4 * 100
const TRN_SELL_TO_POOL = 1; // 12 * 100
const QUANTITY_AT_ONCE = 10; //100
//const TRN_PRICE = "100";

let USDC_100;
let USDC_300;
let USDC_770;
let USDC_100K;

async function waitAndLog(name, tx) {
  let receipt = await tx.wait();
  console.log(name, 
              " receipt status: ", receipt?.status, 
              " receipt gasUsed: ", receipt?.gasUsed.toString(),
              " events: ", receipt?.events.length>0?receipt?.events[0].event:null);
  return receipt;
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
  let tx;

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
  let usdc = await USDC.deploy("USD Coin", "USDC");
  await usdc.deployed();
  console.log("USDC address:", usdc.address);

  let decimals = await usdc.decimals();
  console.log("USDC decimals : ", decimals);

  USDC_100 = ethers.utils.parseUnits("100", decimals);
  USDC_300 = ethers.utils.parseUnits("300", decimals);
  USDC_770 = ethers.utils.parseUnits("770", decimals);
  USDC_100K = ethers.utils.parseUnits("100000", decimals);

  tx = await usdc.mint(deployer.address, USDC_100K);
  await waitAndLog("USDC mint", tx); 

  const TomaasRWN = await hre.ethers.getContractFactory("TomaasRWN");
  const COLLECTION_NAME_1 = "TRN FLO #1";
  const trnFlo1 = await TomaasRWN.deploy(COLLECTION_NAME_1, 
                                usdc.address, 
                                FLO_SSD, 
                                FLO_USEFUL_LIFE, 
                                USDC_770);
  console.log("ToomasRWN deploying...");
  await trnFlo1.deployed();
  console.log("Deployed TRN FLO #1 address:", trnFlo1.address);

  for (let i = 0; i < TRN_MINT_AMOUNT; i++) {
    let tx = await trnFlo1.safeMintMultipleAndSetUser(voAddress,
      TRN_METADATA_URL,
      QUANTITY_AT_ONCE,
      spAddress,
      FLO_RENTAL_EXPIRE);
    await waitAndLog("TRN SafeMintMultipleAndSetUser", tx);
  }

  console.log("ToomasLending deploying...");
  const TomaasLending = await hre.ethers.getContractFactory("TomaasLending");
  const tomaasLending = await TomaasLending.deploy();
  await tomaasLending.deployed();
  console.log("TomaasLending address:", tomaasLending.address);

  tx = await trnFlo1.transferOwnership(tomaasLending.address);
  await waitAndLog("TRN transferOwnership", tx);
 
  tx = await tomaasLending.addCollection(trnFlo1.address, FLO_REVENEUE_SHARE_RATIO);
  await waitAndLog("Lending addCollection", tx);
  
  tx = await tomaasLending.registerRenter(trnFlo1.address, spAddress);
  await waitAndLog("Lending registerRenter", tx);

  console.log("ToomasMarketplace deploying...");
  const TomaasMarketplace = await hre.ethers.getContractFactory("TomaasMarketplace");
  const tomaasMarketplace = await TomaasMarketplace.deploy(tomaasLending.address);
  await tomaasMarketplace.deployed();
  console.log("TomaasMarketplace address:", tomaasMarketplace.address);

  //set approval for all
  tx = await trnFlo1.connect(vehicleOwner).setApprovalForAll(tomaasMarketplace.address, true);
  await waitAndLog("TRN setApprovalForAll", tx);

  // add sales info of 400 TRNs to marketplace
  for (let i=0; i<TRN_FOR_SALES;i++) {
    let tokenIds = [];
    for (let j=0; j<QUANTITY_AT_ONCE; j++) {
      tokenIds.push(i*QUANTITY_AT_ONCE+j);
    }
    tx = await tomaasMarketplace.connect(vehicleOwner).
                                  listingMultipleForSale(trnFlo1.address, USDC_300, tokenIds);
    await waitAndLog("Marketplace listingMultipleForSale", tx);
    console.log("VehicleOnwer's TRN saleInfos:", (
      await tomaasMarketplace.getListedNFTs(trnFlo1.address)).length);
  }

  console.log("ToomasLPN deploying...");
  const TomaasLPN = await hre.ethers.getContractFactory("TomaasLPN");
  const tomaasLPN = await TomaasLPN.deploy(usdc.address, USDC_100);
  await tomaasLPN.deployed();
  console.log("Tomaas LPN address:", tomaasLPN.address);

  tx = await usdc.approve(tomaasLPN.address, USDC_100.mul(10));
  await waitAndLog("USDC approve", tx);
  console.log("USDC approved for LPN :", 
                  (await usdc.allowance(deployer.address, tomaasLPN.address)).toString());

  tx = await tomaasLPN.safeMintMultiple(deployer.address, TLN_METADATA_URL, 10);
  await waitAndLog("LPN safeMintMultiple", tx);
  console.log("Tomaas LPN supply:", (await tomaasLPN.totalSupply()).toString());

  console.log("ToomasStaking deploying...");
  const TomaasSP = await hre.ethers.getContractFactory("TomaasStaking");
  const tomaasStaking = await TomaasSP.deploy(); 
  await tomaasStaking.deployed();
  console.log("Tomaas Staking address:", tomaasStaking.address);

  tx = await tomaasStaking.connect(deployer).
                          addTRNAddress(trnFlo1.address, usdc.address, FLO_REVENEUE_SHARE_RATIO);
  await waitAndLog("Staking add TRN Address", tx);

  let rates = [100, 500, 550, 600, 700, 800, 950, 1100, 1300, 1500, 1800];
  let estimatedGas = await tomaasStaking.estimateGas.addTLNAddress(tomaasLPN.address, usdc.address, USDC_100, rates);
  console.log("estimated gas: ", estimatedGas.toString());
  tx = await tomaasStaking.connect(deployer).addTLNAddress(tomaasLPN.address, usdc.address, USDC_100, rates);
  await waitAndLog("Staking add TLN Address", tx);

  tx = await tomaasLPN.connect(deployer).addToWL(tomaasStaking.address);
  await waitAndLog("LPN add to WL", tx);

  tx = await tomaasStaking.connect(deployer).setPriceOfTRN(trnFlo1.address, USDC_300);
  await waitAndLog("Staking setPriceOfTRN", tx);

  tx = await trnFlo1.connect(vehicleOwner).setApprovalForAll(tomaasStaking.address, true);
  await waitAndLog("Vehicle Owner's TRN setApprovalForAll", tx);

  console.log("listing TRNs for sale to pool");
  for (let i = TRN_FOR_SALES; i < TRN_FOR_SALES+TRN_SELL_TO_POOL; i++) {
    let tokenIds = [];
    for (let j = 0; j < QUANTITY_AT_ONCE; j++) {
      tokenIds.push(i * QUANTITY_AT_ONCE + j);
    }
    tx = await tomaasStaking.connect(vehicleOwner).sellTRNsToPool(trnFlo1.address, tokenIds);
    await waitAndLog("Staking SellTRNsToPool", tx);

    let lengthToPurchase = await tomaasStaking.connect(vehicleOwner).
                                lengthOfTRNsToPurchase(trnFlo1.address);
    console.log("Staking LengthOfTRNsToPurchase: ", 
                                lengthToPurchase.toString());
  }

  tx = await tomaasLPN.connect(deployer).setApprovalForAll(tomaasStaking.address, true);
  await waitAndLog("LPN setApprovalForAll", tx);

  //stake 4 TRNs of 10 TRNs 
  let tokenIds = [0, 1, 2, 3];
  tx = await tomaasStaking.connect(deployer).stakeTLNs(tomaasLPN.address, tokenIds);
  await waitAndLog("Staking StakeTLNs", tx);
  let totalStaked = await tomaasStaking.connect(deployer).totalStakedTokens();
  console.log("total staked tokens: ", totalStaked.toString());

  saveFrontendFiles(usdc, trnFlo1, tomaasLending, tomaasMarketplace, tomaasLPN, tomaasStaking); 
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

  const ERC20MockArtifact = artifacts.readArtifactSync("ERC20Mock");
  fs.writeFileSync(
    path.join(contractsDir, "ERC20Mock.json"),
    JSON.stringify(ERC20MockArtifact, null, 2)
  );

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
