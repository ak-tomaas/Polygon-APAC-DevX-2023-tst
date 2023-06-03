const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");

const { expect } = require("chai");
const { ethers } = require("hardhat");

require("dotenv").config();

describe("TomaasStaking", function () {
  let owner, renter, trnHolder, trnHolder2, tlnHolder, tlnHolder2; 
  let tomaasRWN, tomaasLPN, tomaasStaking;
  let usdc, decimals;
  let USDC_1K, USDC_300, USDC_100;

  const TRN_URI = "https://www.tomaas.ai/trn";
  const TLN_URI = "https://www.tomaas.ai/tln";
  const TRN_NAME_1 = "TomaasRWN #1";
  const TLN_NAME_1 = "TomaasLPN #1";

  const TOKEN_ID = 0;
  const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
  const TRN_TOKEN_NAME = "TRN FLO #1";
  const TRN_TOKEN_SYMBOL = "TRN";
  const REVENUE_SHARE_RATIO = 3000; // 30% 

  const TLN_TOKEN_NAME = "TLN FLO #1";
  const TLN_TOKEN_SYMBOL = "TLN";

  const RWA_SVCSTARTDATE = Math.floor(new Date("2020-11-20").getTime() / 1000);
  const RWA_RENTAL_EXPIRE = new Date("2024-11-19").getTime() / 1000;
  const RWA_USEFUL_LIFE = 4;
  const RWA_PRICE_USDC = "770";

  const TRN_PRICE_USDC = "100";

  beforeEach(async function () {
    [owner, trnHolder, tlnHolder, renter, trnHolder2, tlnHolder2] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    usdc = await ERC20.deploy("USD Coin", "USDC"); 
    await usdc.deployed();
    
    decimals = (await usdc.decimals()).toString();

    USDC_1K = ethers.utils.parseUnits("1000", decimals);
    USDC_300 = ethers.utils.parseUnits("300", decimals);
    USDC_100 = ethers.utils.parseUnits("100", decimals);
    USDC_10 = ethers.utils.parseUnits("10", decimals);

    await usdc.connect(owner).mint(owner.address, USDC_1K);
    await usdc.connect(owner).mint(trnHolder.address, USDC_1K);
    await usdc.connect(owner).mint(tlnHolder.address, USDC_1K);
    await usdc.connect(owner).mint(renter.address, USDC_1K);
    await usdc.connect(owner).mint(trnHolder2.address, USDC_1K);

    const trnPrice = ethers.utils.parseUnits(RWA_PRICE_USDC, decimals);
    const TomaasRWN = await ethers.getContractFactory("TomaasRWN");
    tomaasRWN = await TomaasRWN.deploy(
                            TRN_NAME_1, 
                            usdc.address, 
                            RWA_SVCSTARTDATE,
                            RWA_USEFUL_LIFE, 
                            trnPrice); 
    await tomaasRWN.deployed();

    const tlnPrice = ethers.utils.parseUnits(TRN_PRICE_USDC, decimals);
    const TomaasLPN = await ethers.getContractFactory("TomaasLPN");
    tomaasLPN = await TomaasLPN.deploy(usdc.address, tlnPrice);
    await tomaasLPN.deployed();

    const TomaasStaking = await ethers.getContractFactory("TomaasStaking");
    tomaasStaking = await TomaasStaking.deploy();
    await tomaasStaking.deployed();

    await tomaasStaking.connect(owner).addTRNAddress(tomaasRWN.address, usdc.address, REVENUE_SHARE_RATIO);

    let rates = [100, 500, 550, 600, 700, 800, 950, 1100, 1300, 1500, 1800];
    await tomaasStaking.connect(owner).addTLNAddress(tomaasLPN.address, usdc.address, USDC_100, rates);
    await tomaasLPN.connect(owner).addToWL(tomaasStaking.address);

    await tomaasStaking.connect(owner).setPriceOfTRN(tomaasRWN.address, USDC_300);
  });

  describe("Test basic", function () {
    it("check TRN", async function () {
      let trnInfo = await tomaasStaking.getInfoTRN(tomaasRWN.address);
      expect(trnInfo.tomaasRWN).to.equal(tomaasRWN.address);
      expect(trnInfo.acceptedToken).to.equal(usdc.address);
      expect(trnInfo.revenueShareRatio).to.equal(REVENUE_SHARE_RATIO);
    });

    it("check TLN", async function () {
      const tlnInfo = await tomaasStaking.getInfoTLN(tomaasLPN.address);
      expect(tlnInfo.acceptedToken).to.equal(usdc.address);
      expect(tlnInfo.price).to.equal(USDC_100);
      expect(tlnInfo.interestRates[10]).to.deep.equal(1800);
      //rewards per day of 18%
      let rewardsPerDay = USDC_100.mul(1800).div(10000).div(365);
      expect(tlnInfo.rewardsPerDay[10]).to.deep.equal(rewardsPerDay);
    });

    it("Should stake TLNs", async function () {
      await usdc.connect(tlnHolder).approve(tomaasLPN.address, USDC_100.mul(10));
      await tomaasLPN.connect(tlnHolder).safeMintMultiple(tlnHolder.address, TLN_URI, 10);
      
      let tokenIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      await tomaasLPN.connect(tlnHolder).setApprovalForAll(tomaasStaking.address, true);
      await tomaasStaking.connect(tlnHolder).stakeTLNs(tomaasLPN.address, tokenIds);

      let tokenIdsStaked = await tomaasStaking.connect(tlnHolder).listOfTLNs(tomaasLPN.address);
      expect(tokenIdsStaked.length).to.equal(10);
    });

    it("buy TRNs after TLNs are staked", async function () {

      let prevUsdcOfTrnHolder = await usdc.balanceOf(trnHolder.address);

      await tomaasRWN.connect(owner).safeMintMultiple(trnHolder.address, TRN_URI, 3);
      await tomaasRWN.connect(trnHolder).setApprovalForAll(tomaasStaking.address, true);
      await tomaasStaking.connect(trnHolder).sellTRNsToPool(tomaasRWN.address, [0, 1, 2]);

      let lengthOfTRNsToPurchase = await tomaasStaking.connect(trnHolder).lengthOfTRNsToPurchase(tomaasRWN.address);
      expect(lengthOfTRNsToPurchase).to.equal(3);

      await usdc.connect(tlnHolder).approve(tomaasLPN.address, USDC_300.mul(3));
      await tomaasLPN.connect(tlnHolder).safeMintMultiple(tlnHolder.address, TLN_URI, 9);
      expect(await usdc.balanceOf(tomaasLPN.address)).to.equal(USDC_300.mul(3));
      
      let tokenIds = [0, 1, 2, 3, 4, 5, 6, 7, 8];
      await tomaasLPN.connect(tlnHolder).setApprovalForAll(tomaasStaking.address, true);
      await tomaasStaking.connect(tlnHolder).stakeTLNs(tomaasLPN.address, tokenIds);

      let tokenIdsStaked = await tomaasStaking.connect(tlnHolder).listOfTLNs(tomaasLPN.address);
      expect(tokenIdsStaked.length).to.equal(9);

      await tomaasStaking.connect(owner).buyTRNsFromList(tomaasRWN.address);

      lengthOfTRNsToPurchase = await tomaasStaking.connect(trnHolder).lengthOfTRNsToPurchase(tomaasRWN.address);
      expect(lengthOfTRNsToPurchase).to.equal(0);

      let usdcOfTrnHolder = await usdc.balanceOf(trnHolder.address);
      expect(usdcOfTrnHolder).to.equal(prevUsdcOfTrnHolder.add(USDC_300.mul(3)));
    });

    it("claim from TRNs", async function () {

      await tomaasRWN.connect(owner).safeMintMultipleAndSetUser(
                                            trnHolder.address,
                                            TRN_URI,
                                            3,
                                            renter.address,
                                            RWA_RENTAL_EXPIRE);

      await tomaasRWN.connect(trnHolder).setApprovalForAll(tomaasStaking.address, true);
      await tomaasStaking.connect(trnHolder).sellTRNsToPool(tomaasRWN.address, [0, 1, 2]);

      await usdc.connect(tlnHolder).approve(tomaasLPN.address, USDC_300.mul(3));
      await tomaasLPN.connect(tlnHolder).safeMintMultiple(tlnHolder.address, TLN_URI, 9);
      
      let tokenIds = [0, 1, 2, 3, 4, 5, 6, 7, 8];
      await tomaasLPN.connect(tlnHolder).setApprovalForAll(tomaasStaking.address, true);
      await tomaasStaking.connect(tlnHolder).stakeTLNs(tomaasLPN.address, tokenIds);

      await tomaasStaking.connect(owner).buyTRNsFromList(tomaasRWN.address);

      await usdc.connect(renter).approve(tomaasRWN.address, USDC_1K);
      await tomaasRWN.connect(renter).payOutEarningsAllRented(USDC_1K, "https://reports");

      let trnAmount = await usdc.balanceOf(tomaasRWN.address);
      expect(trnAmount).to.equal(USDC_1K);

      let prevAmount = await usdc.balanceOf(tomaasStaking.address);
      await tomaasStaking.connect(owner).claimFromTRNs(tomaasRWN.address);
      let postAmount = await usdc.balanceOf(tomaasStaking.address);
      expect(postAmount).to.equal(USDC_1K.sub(USDC_10));
    });

    it("claim by TLN holder", async function () {
      await tomaasRWN.connect(owner).safeMintMultipleAndSetUser(
        trnHolder.address,
        TRN_URI,
        3,
        renter.address,
        RWA_RENTAL_EXPIRE);

      await tomaasRWN.connect(trnHolder).setApprovalForAll(tomaasStaking.address, true);
      await tomaasStaking.connect(trnHolder).sellTRNsToPool(tomaasRWN.address, [0, 1, 2]);

      await usdc.connect(tlnHolder).approve(tomaasLPN.address, USDC_300.mul(3));
      await tomaasLPN.connect(tlnHolder).safeMintMultiple(tlnHolder.address, TLN_URI, 9);

      let tokenIds = [0, 1, 2, 3]
      await tomaasLPN.connect(tlnHolder).setApprovalForAll(tomaasStaking.address, true);
      await tomaasStaking.connect(tlnHolder).stakeTLNs(tomaasLPN.address, tokenIds);

      //Two days have passed.
      //await network.provider.send("evm_increaseTime", [60 * 60 * 24 * 2]);
      await time.increaseTo(await time.latest() + time.duration.days(2));

      await tomaasStaking.connect(owner).buyTRNsFromList(tomaasRWN.address);

      await usdc.connect(renter).approve(tomaasRWN.address, USDC_1K);
      await tomaasRWN.connect(renter).payOutEarningsAllRented(USDC_1K, "https://reports");

      let trnAmount = await usdc.balanceOf(tomaasRWN.address);
      expect(trnAmount).to.equal(USDC_1K);

      await tomaasStaking.connect(owner).claimFromTRNs(tomaasRWN.address);

      await time.increaseTo(await time.latest() + time.duration.days(2));

      tokenIds = [4, 5, 6, 7, 8];
      await tomaasStaking.connect(tlnHolder).stakeTLNs(tomaasLPN.address, tokenIds);

      await time.increaseTo(await time.latest() + time.duration.days(2));

      let prevAmount = await usdc.balanceOf(tlnHolder.address);
      // console.log ("prevAmount: ", prevAmount);
      await tomaasStaking.connect(tlnHolder).claim(tomaasLPN.address);
      let postAmount = await usdc.balanceOf(tlnHolder.address);
      // console.log ("postAmount: ", postAmount);
    });
    it("balance of rewards", async function () {
      let total = await tomaasStaking.connect(owner).balanceOfRewards();
    });
    it("total claimed rewards", async function () {
      let total = await tomaasStaking.connect(owner).totalClaimedRewards();
    });
    // it("unstaked before claim", async function () {
    // });

    // it("unstaked after claim", async function () {
    // });

    // it("prevent unstaked", async function () {
    // });
  });
});