const {
    time,
    loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TomaasRWN", function () {
    let owner, renter, holder, buyer, holder2, renter2, buyer2;
    let TomaasRWN, tomaasRWN;
    let usdc, decimals;

    const NFT_URI = "https://www.tomaas.ai/nft";
    const TOKEN_ID = 0;
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const TOKEN_NAME = "Trustless Ondemand Mobility Vehicle Ownership pre #1";
    const TOKEN_SYMBOL = "TRN";
    const RWA_SVCSTARTDATE = Math.floor(new Date("2020-11-20").getTime() / 1000);
    const RWA_USEFUL_LIFE = 4;
    const RWA_PRICE_USDC = "770";

    beforeEach(async function () {
        [owner, holder, renter, buyer, holder2, renter2, buyer2] = await ethers.getSigners();
    
        const ERC20 = await ethers.getContractFactory("ERC20Mock");
        usdc = await upgrades.deployProxy(ERC20, ["USD Coin", "USDC"]);
        await usdc.deployed();

        decimals = (await usdc.decimals()).toString();

        const TWO_USDC = ethers.utils.parseUnits("2", decimals);

        await usdc.connect(owner).mint(owner.address, TWO_USDC);
        await usdc.connect(owner).mint(holder.address, TWO_USDC);
        await usdc.connect(owner).mint(renter.address, TWO_USDC);

        TomaasRWN = await ethers.getContractFactory("TomaasRWN");

        const svcStartDate = Math.floor(new Date("2020-11-20").getTime() / 1000);

        const price = ethers.utils.parseUnits(RWA_PRICE_USDC, decimals);
        tomaasRWN = await upgrades.deployProxy(TomaasRWN, [
                                        TOKEN_NAME, 
                                        usdc.address, 
                                        RWA_SVCSTARTDATE,
                                        RWA_USEFUL_LIFE, price]);
        await tomaasRWN.deployed();
    });

    describe("mint", function () {
        it("should mint a new token with the given URI", async function () {
            expect(await tomaasRWN.name()).to.equal(TOKEN_NAME);
            expect(await tomaasRWN.symbol()).to.equal(TOKEN_SYMBOL);

            const tx = await tomaasRWN.connect(owner).safeMint(holder.address, NFT_URI);
            await tx.wait();

            expect(await tomaasRWN.balanceOf(holder.address)).to.equal(1);

            const tokenURIStored = await tomaasRWN.tokenURI(TOKEN_ID);
            expect(tokenURIStored).to.equal(NFT_URI);
        });
    });

    describe("minting multiple tokens", function() {
        it("should mint the correct number of tokens", async function() {
            const initialSupply = await tomaasRWN.totalSupply();

            // Mint multiple tokens
            await tomaasRWN.connect(owner).safeMintMultiple(holder.address, NFT_URI, 5);

            // Check the total supply increased by the correct amount
            expect(await tomaasRWN.totalSupply()).to.equal(initialSupply + 5);
        });

        it("should assign ownership of the minted tokens to the correct address", async function() {
            // Mint multiple tokens
            await tomaasRWN.connect(owner).safeMintMultiple(holder.address, NFT_URI, 5);

            // Check the last 5 tokens are owned by addr1
            const totalSupply = await tomaasRWN.totalSupply();

            for (let i = totalSupply - 5; i < totalSupply; i++) {
                expect(await tomaasRWN.ownerOf(i)).to.equal(holder.address);
            }
        });
    });

    describe("setUser", function() {
        it("should set the user and expires of a token", async function() {
          const tx = await tomaasRWN.connect(owner).safeMint(holder.address, NFT_URI);
          await tx.wait();

          const expires = (await time.latest()) + 3600;
          const tx2 = await tomaasRWN.connect(holder).setUser(TOKEN_ID, renter.address, expires);
          await tx2.wait();
    
          const user = await tomaasRWN.userOf(TOKEN_ID);
          expect(user).to.equal(renter.address);

          const tokenIds = await tomaasRWN.getRentedList(renter.address);
          expect(tokenIds.length).to.equal(1);
    
          const userExpires = await tomaasRWN.userExpires(TOKEN_ID);
          expect(userExpires).to.equal(expires);
        });

        it("should revert if the caller is not the token owner", async function () {
            await tomaasRWN.connect(owner).safeMint(holder.address, NFT_URI);

            const expires = Math.floor(Date.now() / 1000) + 3600;
            await expect(tomaasRWN.connect(renter).setUser(
                TOKEN_ID, renter.address, expires)).to.be.revertedWith(
                    "RWN: notOwnerOrAppr");
        });

        it("should revert if the token does not exist", async function () {
            const expires = Math.floor(Date.now() / 1000) + 3600;
            await expect(tomaasRWN.connect(owner).setUser(
                TOKEN_ID, renter.address, expires)).to.be.revertedWith(
                    "RWN: tokenDoesNotExi");
        });

        it("should handle multiple NFTs with different users and expiries", async function () {
            // Mint two NFTs with different URIs and assign them to different users with different expiry times
            await tomaasRWN.safeMint(holder.address, "uri1");
            await tomaasRWN.safeMint(holder2.address, "uri2");
        
            const user1TokenId = 0;
            const user2TokenId = 1;
        
            const expires = (await time.latest()) + 3600;
            const expires2 = (await time.latest()) + 7200;
            const tx = await tomaasRWN.connect(holder).setUser(user1TokenId, renter.address, expires); // set user1 to expire in 1 hour
            await tx.wait();
            const tx2 = await tomaasRWN.connect(holder2).setUser(user2TokenId, renter2.address, expires2); // set user2 to expire in 2 hours
            await tx2.wait();
        
            expect(await tomaasRWN.userOf(user1TokenId)).to.equal(renter.address);
            expect(await tomaasRWN.userOf(user2TokenId)).to.equal(renter2.address);
        
            expect(await tomaasRWN.userExpires(user1TokenId)).to.equal(expires);
            expect(await tomaasRWN.userExpires(user2TokenId)).to.equal(expires2);
        
            // Wait for user1 to expire
            await time.increaseTo(await time.latest() + 4000);
        
            // Check that user1 is now expired
            expect(await tomaasRWN.userOf(user1TokenId)).to.equal(ethers.constants.AddressZero);
            expect(await tomaasRWN.userOf(user2TokenId)).to.equal(renter2.address);
        });

    });

    describe("transfer", function() {
        it("should transfer a token and keep the rental user", async function() {
          const tx = await tomaasRWN.connect(owner).safeMint(holder.address, NFT_URI);
          await tx.wait();
    
          const expires = (await time.latest()) + 3600;
          const tx2 = await tomaasRWN.connect(holder).setUser(TOKEN_ID, renter.address, expires);
          await tx2.wait();
    
          const tx3 = await tomaasRWN.connect(holder).transferFrom(holder.address, buyer.address, TOKEN_ID);
          await tx3.wait();
    
          const user = await tomaasRWN.userOf(TOKEN_ID);
          expect(user).to.equal(renter.address);
        });
    
        it("should user of the token after it has expired", async function() {
            const tx = await tomaasRWN.connect(owner).safeMint(holder.address, NFT_URI);
            await tx.wait();
      
            const expires = (await time.latest()) + 1;
            const tx2 = await tomaasRWN.connect(holder).setUser(TOKEN_ID, renter.address, expires);
            await tx2.wait();
      
            // wait for the rental to expire
            await time.increaseTo(await time.latest() + 10);
      
            const user = await tomaasRWN.userOf(TOKEN_ID);
            expect(user).to.equal(ethers.constants.AddressZero);
          });
      });

    describe("earnings", () => {
        it("should payout earnings for an NFT", async () => {
            const tx = await tomaasRWN.connect(owner).safeMint(holder.address, NFT_URI);
            await tx.wait();
            
            const expires = (await time.latest()) + 3600;
            const tx2 = await tomaasRWN.connect(holder).setUser(TOKEN_ID, renter.address, expires);
            await tx2.wait();

            const amount = ethers.utils.parseUnits("1", decimals);
            await usdc.connect(renter).approve(tomaasRWN.address, amount);
            await tomaasRWN.connect(renter).payOutEarnings(TOKEN_ID, amount, "Settlement-uri");
            expect(await tomaasRWN.unClaimedEarnings(TOKEN_ID)).to.equal(amount);
        });

        it("should allow user to pay out earnings for all rented NFTs", async () => {
            await tomaasRWN.connect(owner).safeMint(holder.address, NFT_URI);
            const tx = await tomaasRWN.connect(owner).safeMint(holder.address, "NFT-uri-2");
            await tx.wait();

            const expires = (await time.latest()) + 3600;
            await tomaasRWN.connect(holder).setUser(TOKEN_ID, renter.address, expires);
            const tokenId2 = 1;
            const tx2 = await tomaasRWN.connect(holder).setUser(tokenId2, renter.address, expires);

            const tokenIds = await tomaasRWN.getRentedList(renter.address);
            expect(tokenIds.length).to.equal(2);

            // Renter pays out earnings for all rented NFTs
            const amount = ethers.utils.parseUnits("2", decimals);
            await usdc.connect(renter).approve(tomaasRWN.address, amount);
            await tomaasRWN.connect(renter).payOutEarningsAllRented(amount, "Settlement-uri");

            const unclaimed = await tomaasRWN.unClaimedEarnings(TOKEN_ID);
            expect(unclaimed).to.equal(amount.div(2));

            const unclaimedAll = await tomaasRWN.connect(holder).unClaimedEarningsAll();
            expect(unclaimedAll).to.equal(amount);
        });

        it("should distribute fees to owner and balance to user upon claiming earnings", async () => {
            // mint a new NFT and set user to account1
            await tomaasRWN.safeMint(holder.address, NFT_URI);
            const expires = (await time.latest()) + 3600;
            await tomaasRWN.connect(holder).setUser(TOKEN_ID, renter.address, expires);
          
            const ONE_USDC = ethers.utils.parseUnits("1", decimals);
            // pay rent for 1 USDC
            await usdc.connect(renter).approve(tomaasRWN.address, ONE_USDC);
            await tomaasRWN.connect(renter).payOutEarnings(TOKEN_ID, ONE_USDC, "Settlement-uri");
            
            // claim earnings for holder
            const holderBalanceBefore = await usdc.balanceOf(holder.address);
            const ownerBalanceBefore = await usdc.balanceOf(owner.address);
            const receipt = await tomaasRWN.connect(holder).claimEarnings(TOKEN_ID);
            const holderBalanceAfter = await usdc.balanceOf(holder.address);
            const ownerBalanceAfter = await usdc.balanceOf(owner.address);
            
            // check that the earnings were distributed correctly
            const feeRate = await tomaasRWN.getFeeRate();
            const expectedFee = ethers.utils.parseUnits("0.01", decimals); // 1% fee
            const expectedAmountToOwner = expectedFee;
            const expectedAmountToHolder = ethers.utils.parseUnits("0.99", decimals);
            expect(holderBalanceAfter.sub(holderBalanceBefore)).to.equal(expectedAmountToHolder);
            expect(ownerBalanceAfter.sub(ownerBalanceBefore)).to.equal(expectedAmountToOwner);
          });

          it("should allow multiple users to rent the same NFT and distribute earnings correctly", async () => {
          });
    });

    describe("Depreciation", () => {
        it("Should return correct book value", async function () {
            let sec2day = 60 * 60 * 24;
            let price = ethers.utils.parseUnits("770", 0);
            let decliningBalance = price / (RWA_USEFUL_LIFE * 365);
            let restOfDays = (RWA_SVCSTARTDATE / sec2day + RWA_USEFUL_LIFE * 365) - (new Date()).getTime()/ 1000 / sec2day;
            let expBookValue = decliningBalance * restOfDays;

            let result = await tomaasRWN.getBookValue();
            let bookValue = ethers.utils.formatUnits(result, decimals);

            //console.log(expBookValue, bookValue);
            expect(Math.round(expBookValue)).to.equal(Math.round(bookValue));
        });
    });

    describe("3,000 NFTs", () => {
        it("should be able to mint 10,000 NFTs", async () => {
            const FLO_RENTAL_EXPIRE = new Date("2024-11-19").getTime() / 1000;

            for (let i = 0; i < 30; i++) {
                await tomaasRWN.safeMintMultipleAndSetUser(holder.address,
                    NFT_URI,
                    100,
                    renter.address,
                    FLO_RENTAL_EXPIRE);
                console.log("TRN FLO #1 supply:", (await tomaasRWN.totalSupply()).toString());
            }

            let tokenIds = await tomaasRWN.getRentedList(renter.address);
            expect(tokenIds.length).to.equal(3000);

            const SETTLEMENT_URI = "https://arweave.net/2IL5TQHMii48o0zjZmohCzj4oCb-qIH5XhLzm8BjCd8";
            const pay = 18341;
            const amount = ethers.utils.parseUnits(pay.toString(), decimals);

            await usdc.connect(renter).mint(renter.address, amount);
            await usdc.connect(renter).approve(tomaasRWN.address, amount);

            //seperate into 30 transactions
            function chunkArray(myArray, chunk_size) {
                var results = [];
            
                for (let i = 0; i < myArray.length; i += chunk_size) {
                    results.push(myArray.slice(i, i + chunk_size));
                }
                return results;
            }

            const txCount = 30;
            const perAmount = amount.div(txCount);

            let tokenIdsChunked = chunkArray(tokenIds, tokenIds.length / txCount);
            expect(tokenIdsChunked.length).to.equal(txCount);
            expect(tokenIdsChunked[0].length).to.equal(tokenIds.length / txCount);

            for (let i = 0; i < txCount; i++) {
                let tokenIds = tokenIdsChunked[i];
                await tomaasRWN.connect(renter).payOutEarningsMultiple(perAmount, tokenIds, SETTLEMENT_URI);
                console.log("TRN FLO #1 payOut i=", i, " perAmount=", perAmount.toString(), " tokenIds=", tokenIds.length);
            }

            const unclaimedAll = await tomaasRWN.connect(holder).unClaimedEarningsAll();
            const unClaimedAmount = ethers.utils.formatUnits(unclaimedAll, decimals);
            const amountAll = ethers.utils.formatUnits(amount, decimals);
            expect(Math.round(unClaimedAmount)).to.equal(Math.round(amountAll));
            await tomaasRWN.connect(holder).claimEarningsAllRented();

            const restAmount = await tomaasRWN.connect(holder).unClaimedEarningsAll();
            expect(restAmount).to.equal(0);

        }).timeout(5000000);
    });

    describe("stress test", () => {
        it("should handle multiple users renting the same NFT", async function() {
        });
        it("handles a large number of NFTs and users without performance issues", async () => {
        });
    });
});
