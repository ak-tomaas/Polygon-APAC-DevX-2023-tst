const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

require("dotenv").config();

describe("TomaasLending", function () {
  let owner, renter, holder, buyer, holder2, renter2, buyer2;
  let TomaasRWN, tomaasRWN;
  let usdc;

  const NFT_URI = "https://www.tomaas.ai/nft";
  const ONE_USDC = ethers.utils.parseUnits("1", 6);
  const TWO_USDC = ethers.utils.parseUnits("2", 6);
  const USDC_DECIMALS = 6;

  const TOKEN_ID = 0;
  const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
  const TOKEN_NAME = "Trustless Ondemand Mobility Vehicle Ownership pre #1";
  const TOKEN_SYMBOL = "RWN";

  const COLLECTION_NAME_1 = "TomaasRWN #1";
  const COLLECTION_NAME_2 = "TomaasRWN #2";
  const collectionSupply = 10;
  const REVENUE_SHARE_RATIO = 3000; // 30% 

  beforeEach(async function () {
    [owner, holder, renter, buyer, holder2, renter2, buyer2] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    usdc = await ERC20.deploy("USD Coin", "USDC");
    await usdc.deployed();

    await usdc.connect(owner).mint(owner.address, TWO_USDC.mul(1000000));
    await usdc.connect(owner).mint(holder.address, TWO_USDC.mul(1000000));
    await usdc.connect(owner).mint(renter.address, TWO_USDC.mul(1000000));

    // Deploy TomaasRWN
    TomaasRWN = await ethers.getContractFactory("TomaasRWN");
    tomaasRWN = await TomaasRWN.deploy(COLLECTION_NAME_1, usdc.address, 1647542400, 4, 1000);
    await tomaasRWN.deployed();

    const TomaasLending = await ethers.getContractFactory("TomaasLending");
    tomaasLending = await TomaasLending.deploy();
    await tomaasLending.deployed();

    await tomaasRWN.connect(owner).transferOwnership(tomaasLending.address);
    await tomaasLending.connect(owner).addCollection(tomaasRWN.address, REVENUE_SHARE_RATIO);
  });

  describe("collection", function () {
    it("should add a new collection", async function () {
      // Test case code
      const TomaasRWN = await ethers.getContractFactory("TomaasRWN");
      const tomNFT2 = await TomaasRWN.deploy(COLLECTION_NAME_2, usdc.address, 1647542400, 4, 1000);
      await tomNFT2.deployed();

      const tx = await tomaasLending.addCollection(tomNFT2.address, REVENUE_SHARE_RATIO);
      await tx.wait();

      expect(await tomaasLending.getCollectionIndex(tomNFT2.address)).to.equal(1);
      expect(await tomaasLending.getCollections()).to.have.length(2);
      const collection = await tomaasLending.getCollectionAt(1);
      expect(collection.tomaasRWN).to.equal(tomNFT2.address);
      expect(collection.acceptedToken).to.equal(usdc.address);
    });
    it("should revert if NFT address is zero", async function () {
      await expect(tomaasLending.addCollection(ethers.constants.AddressZero, REVENUE_SHARE_RATIO)).to.be.revertedWith("LP: NFT Addr=0");
    });
  });

  describe("list for Rent", async function () {
    it("should revert if it is not approved", async function () {
      await tomaasLending.safeMintNFT(tomaasRWN.address, holder.address, NFT_URI);
      await expect(tomaasLending.connect(holder).listingNFT(
        tomaasRWN.address, TOKEN_ID)).to.be.revertedWith("LP: notApproved");
    });
    it("should allow listing of NFTs when approve is used", async function () {
      await tomaasLending.safeMintNFT(tomaasRWN.address, holder.address, NFT_URI);
      await tomaasRWN.connect(holder).approve(tomaasLending.address, TOKEN_ID);
      await tomaasLending.connect(holder).listingNFT(tomaasRWN.address, TOKEN_ID);
      const nfts = await tomaasLending.getListingNFTs(tomaasRWN.address);
      expect(nfts.length).to.equal(1);
    });
    it("should allow listing of NFTs when setApprovalForAll is used", async function () {
      await tomaasLending.safeMintNFT(tomaasRWN.address, holder.address, NFT_URI);
      await tomaasRWN.connect(holder).setApprovalForAll(tomaasLending.address, true);
      await tomaasLending.connect(holder).listingNFT(tomaasRWN.address, TOKEN_ID);
      const nfts = await tomaasLending.getListingNFTs(tomaasRWN.address);
      expect(nfts.length).to.equal(1);
    });
  });

  describe("Settlement reports", function () {
    it("Should add and get settlement report correctly", async function () {
      // Assuming addr1 is the NFT address
      const nftAddress = tomaasRWN.address;
      const SETTLEMENT_DATE1 = new Date("2023-05-08").getTime() / 1000;
      const SETTLEMENT_DATE2 = new Date("2023-05-15").getTime() / 1000;
      const SETTLEMENT_DATE3 = new Date("2023-05-22").getTime() / 1000;

      const reportUri1 = "ipfs://example1";
      const reportUri2 = "ipfs://example2";
      const reportUri3 = "ipfs://example3";
      await tomaasLending.connect(owner).
        storeSettlementReport(
          nftAddress,
          renter.address,
          SETTLEMENT_DATE1,
          reportUri1);
      await tomaasLending.connect(owner).
        storeSettlementReport(
          nftAddress,
          renter.address,
          SETTLEMENT_DATE2,
          reportUri2);
      await tomaasLending.connect(owner).
        storeSettlementReport(
          nftAddress,
          renter.address,
          SETTLEMENT_DATE3,
          reportUri3);

      // Get last 2 reports
      const reports = await tomaasLending.
        connect(owner).
        getSettlementReportsFromLast(
          nftAddress, renter.address, 2);

      console.log(reports);

      expect(reports[0]).to.equal(reportUri3);
      expect(reports[1]).to.equal(reportUri2);

      //it's not add, it's update
      await tomaasLending.connect(owner).
        storeSettlementReport(
          nftAddress,
          renter.address,
          SETTLEMENT_DATE2,
          reportUri2);
      const count = await tomaasLending.connect(owner).
        getSettlementReportCount(nftAddress, renter.address);
      expect(count).to.equal(3);
    });
  });

  describe('Register and Unregister renters', function () {
    it('Should register a new renter', async function () {
      await tomaasLending.connect(owner).registerRenter(tomaasRWN.address, renter.address);
      const renters = await tomaasLending.listRenters(tomaasRWN.address);

      // Assert
      expect(renters).to.include(renter.address);
    });

    it('Should not register an already registered renter', async function () {
      await tomaasLending.connect(owner).registerRenter(tomaasRWN.address, renter.address);

      // Try to re-register, should fail
      await expect(tomaasLending.connect(owner).registerRenter(tomaasRWN.address, renter.address))
        .to.be.revertedWith('TL: already registered');
    });

    it('Should unregister a renter', async function () {
      await tomaasLending.connect(owner).registerRenter(tomaasRWN.address, renter.address);
      await tomaasLending.connect(owner).unRegisterRenter(tomaasRWN.address, renter.address);

      const renters = await tomaasLending.listRenters(tomaasRWN.address);

      // Assert
      expect(renters).to.not.include(renter2.address);
    });

    it('Should not unregister a not registered renter', async function () {
      // Try to unregister, should fail
      await expect(tomaasLending.connect(owner).unRegisterRenter(tomaasRWN.address, renter2.address))
        .to.be.revertedWith('TL: not registered');
    });
  });
});

