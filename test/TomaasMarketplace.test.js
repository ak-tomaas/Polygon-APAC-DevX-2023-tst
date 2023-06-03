const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");

const { expect } = require("chai");

require("dotenv").config();

describe("TomaasMarketplace", function () {
  let owner, renter, holder, buyer, holder2, renter2, buyer2;
  let tomaasRWN, tomaasLending, tomaasMarketplace;
  let usdc, decimals;
  let ONE_USDC, TWO_USDC;

  const NFT_URI = "https://www.tomaas.ai/nft";
  const COLLECTION_NAME_1 = "TomaasRWN #1";

  const TOKEN_ID = 0;
  const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
  const TOKEN_NAME = "Trustless Ondemand Mobility Vehicle Ownership pre #1";
  const TOKEN_SYMBOL = "RWN";
  const REVENUE_SHARE_RATIO = 3000; // 30% 

  const RWA_SVCSTARTDATE = Math.floor(new Date("2020-11-20").getTime() / 1000);
  const RWA_USEFUL_LIFE = 4;
  const RWA_PRICE_USDC = "770";

  beforeEach(async function () {
    [owner, holder, renter, buyer, holder2, renter2, buyer2] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    usdc = await ERC20.deploy("USD Coin", "USDC"); 
    await usdc.deployed();
    
    decimals = (await usdc.decimals()).toString();

    ONE_USDC = ethers.utils.parseUnits("1", decimals);
    TWO_USDC = ethers.utils.parseUnits("2", decimals);

    await usdc.connect(owner).mint(owner.address, TWO_USDC);
    await usdc.connect(owner).mint(holder.address, TWO_USDC);
    await usdc.connect(owner).mint(buyer.address, TWO_USDC);

    await usdc.connect(holder2).mint(holder2.address, TWO_USDC);

    // Deploy TomaasRWN
    const price = ethers.utils.parseUnits(RWA_PRICE_USDC, decimals);
    const TomaasRWN = await ethers.getContractFactory("TomaasRWN");
    tomaasRWN = await TomaasRWN.deploy(
                           COLLECTION_NAME_1, 
                            usdc.address, 
                            RWA_SVCSTARTDATE,
                            RWA_USEFUL_LIFE, 
                            price); 
    await tomaasRWN.deployed();

    const TomaasLending = await ethers.getContractFactory("TomaasLending");
    tomaasLending = await TomaasLending.deploy();
    await tomaasLending.deployed();

    await tomaasRWN.connect(owner).transferOwnership(tomaasLending.address);
    await tomaasLending.connect(owner).addCollection(tomaasRWN.address, REVENUE_SHARE_RATIO); 

    // Deploy the TomaasMarketplace contract
    const TomaasMarketplace = await ethers.getContractFactory("TomaasMarketplace");
    tomaasMarketplace = await TomaasMarketplace.deploy(tomaasLending.address);
    await tomaasMarketplace.deployed();

    await tomaasLending.safeMintNFT(tomaasRWN.address, holder.address, NFT_URI);
    await tomaasLending.safeMintNFT(tomaasRWN.address, holder.address, NFT_URI);
    await tomaasLending.safeMintNFT(tomaasRWN.address, holder.address, NFT_URI);
    await tomaasLending.safeMintNFT(tomaasRWN.address, holder.address, NFT_URI);

    const tx = await tomaasMarketplace.connect(holder).listingForSale(tomaasRWN.address, TOKEN_ID, ONE_USDC);

    // const receipt = await tx.wait();
    // const event = receipt.events.filter((x) => { return x.event == "NFTListedForSale"; });
    // console.log(event[0].args);

    const saleInfos = await tomaasMarketplace.getListedNFTs(tomaasRWN.address);

    expect(saleInfos.length).to.equal(1);
    const saleInfo = saleInfos[0];
    expect(saleInfo.tokenId).to.equal(TOKEN_ID);
    expect(saleInfo.seller).to.equal(holder.address);
    expect(saleInfo.price).to.equal(ONE_USDC);
    expect(saleInfo.isAvailable).to.equal(true);
  });

  describe("listing", function () {
    it("should allow a seller to list an NFT for sale", async function () {
      expect(await tomaasMarketplace.isForSale(tomaasRWN.address, 
                  TOKEN_ID)).to.equal(true);
    });
  });

  describe("buying", function () {
    it("should not allow a buyer to buy an NFT for an incorrect price", async function () {
      await expect(tomaasMarketplace.connect(buyer).buyNFT(tomaasRWN.address, 
                  TOKEN_ID, TWO_USDC)).to.be.revertedWith("TM: price is not correct");
    });
  
    it("should not allow a buyer to buy an NFT if they do not have enough tokens", async function () {
      await expect(tomaasMarketplace.connect(buyer2).buyNFT(tomaasRWN.address, 
                  TOKEN_ID, ONE_USDC)).to.be.revertedWith("TM: not enough token balance");
    });

    it("should allow a buyer to buy an NFT", async function () {
      await usdc.connect(buyer).approve(tomaasMarketplace.address, ONE_USDC); 
      await tomaasRWN.connect(holder).approve(tomaasMarketplace.address, TOKEN_ID);
      await tomaasMarketplace.connect(buyer).buyNFT(tomaasRWN.address, 
                  TOKEN_ID, ONE_USDC);
      await expect(tomaasMarketplace.isForSale(tomaasRWN.address, 
                  TOKEN_ID)).to.be.revertedWith("TM: there isnot this NFT for sale");
    });
  });

  describe("listing & buying multiple", function () {
    it("Listing multiple NFTs for sale", async () => {
      const tokenIds = [1, 2, 3]; // assume these token IDs exist and belong to accounts[0]
  
      await tomaasMarketplace.connect(holder).listingMultipleForSale(
                                tomaasRWN.address, 
                                ONE_USDC, 
                                tokenIds);
  
      // Verify each NFT is listed
      for (let i = 0; i < tokenIds.length; i++) {
        const saleInfo = await tomaasMarketplace.getSaleInfo(tomaasRWN.address, tokenIds[i]);
        expect(saleInfo.tokenId).to.equal(tokenIds[i]);
        expect(saleInfo.price).to.equal(ONE_USDC);
        expect(saleInfo.seller).to.equal(holder.address);
        expect(saleInfo.isAvailable).to.equal(true);
      }
    });
  
    it("Buying multiple NFTs", async () => {
      const tokenIds = [1, 2, 3]; // assume these token IDs are listed for sale
      const prices = Array(tokenIds.length).fill(ONE_USDC); // Assuming the price for each NFT is 1 USDC
  
      const TEN_USDC = ethers.utils.parseUnits("10", decimals);
      await usdc.connect(owner).mint(buyer.address, TEN_USDC);

      await tomaasMarketplace.connect(holder).listingMultipleForSale(
                                tomaasRWN.address, 
                                ONE_USDC, 
                                tokenIds);

      let saleInfos = await tomaasMarketplace.getListedNFTs(tomaasRWN.address);
      expect(saleInfos.length).to.equal(4); //already listed 1 NFT, now 3 more

      // Assume accounts[1] has enough ERC20 tokens to buy the NFTs
      const sumOfPrices = prices.reduce((a, b) => a.add(b), ethers.BigNumber.from(0));
      await usdc.connect(buyer).approve(tomaasMarketplace.address, sumOfPrices); // 3 NFTs * 1 USDC each

      await tomaasRWN.connect(holder).setApprovalForAll(tomaasMarketplace.address, true);
      await tomaasMarketplace.connect(buyer).buyMultipleNFT(tomaasRWN.address, prices, tokenIds);
        
      // Verify each NFT is bought
      for (let i = 0; i < tokenIds.length; i++) {
        const owner = await tomaasRWN.ownerOf(tokenIds[i]);
        expect(owner).to.equal(buyer.address);
      }

      saleInfos = await tomaasMarketplace.getListedNFTs(tomaasRWN.address);
      expect(saleInfos.length).to.equal(1); //only 1 NFT left
    });
  });
});
