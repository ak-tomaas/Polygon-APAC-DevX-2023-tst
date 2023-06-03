const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

require("dotenv").config();

let usdc;

describe("TomaasLPN", function () {
  let TomaasLPN, tomaasLPN, owner, addr1;
  let tokenURI = "https://ipfs.io/ipfs/Qm..."; // Add your tokenURI here
  const USDC_UNIT = ethers.utils.parseUnits("1000", 6).mul(1000000);

  beforeEach(async () => {
    [owner, addr1] = await ethers.getSigners();

    const ERC20 = await ethers.getContractFactory("ERC20Mock");
    usdc = await upgrades.deployProxy(ERC20, ["USD Coin", "USDC"]);
    await usdc.deployed();

    await usdc.connect(owner).mint(owner.address, USDC_UNIT);
    await usdc.connect(owner).mint(addr1.address, USDC_UNIT);

    TomaasLPN = await ethers.getContractFactory("TomaasLPN");
    tomaasLPN = await upgrades.deployProxy(TomaasLPN, [
      usdc.address,
      ethers.utils.parseUnits("100", 6).mul(1000000),
    ]);
    await tomaasLPN.deployed();

    // const poolMock = await ethers.getContractFactory("PoolMock");
    // MockContract = await upgrades.deployProxy(poolMock, [
    //   usdc.address,
    //   tomaasLPN.address,
    // ]);
    // await MockContract.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await tomaasLPN.owner()).to.equal(owner.address);
    });

    it("Should initialize the contract", async function () {
      expect(await tomaasLPN.name()).to.equal("Tomaas Liquidity Provider NFT");
      expect(await tomaasLPN.symbol()).to.equal("TLN");
    });

    it("should pause and unpause the contract", async function () {
      expect(await tomaasLPN.paused()).to.equal(false);

      await tomaasLPN.pause();
      expect(await tomaasLPN.paused()).to.equal(true);

      await tomaasLPN.unpause();
      expect(await tomaasLPN.paused()).to.equal(false);
    });
  });

  describe("Transactions", function () {
    it("Should mint a new token AND Compare USCD Balance", async function () {
      await usdc
        .connect(addr1)
        .approve(
          tomaasLPN.address,
          ethers.utils.parseUnits("100", 6).mul(1000000)
        );
      await tomaasLPN.connect(addr1).safeMintMultiple(addr1.address, tokenURI, 1);
      const Addr1Bal = await usdc.balanceOf(addr1.address);
      const ContractBal = await usdc.balanceOf(tomaasLPN.address);
      expect(await tomaasLPN.balanceOf(addr1.address)).to.equal(1);
      expect(await tomaasLPN.tokenURI(0)).to.equal(tokenURI);
      expect(Addr1Bal).to.equal(ethers.utils.parseUnits("900", 6).mul(1000000));
      expect(ContractBal).to.equal(
        ethers.utils.parseUnits("100", 6).mul(1000000)
      );
    });

    it("Should mint 5 new token AND Compare USDC Balance", async function () {
      await usdc
        .connect(addr1)
        .approve(
          tomaasLPN.address,
          ethers.utils.parseUnits("500", 6).mul(1000000)
        );
      await tomaasLPN.connect(addr1).safeMintMultiple(addr1.address, tokenURI, 5);
      const Addr1Bal = await usdc.balanceOf(addr1.address);
      const ContractBal = await usdc.balanceOf(tomaasLPN.address);
      expect(await tomaasLPN.balanceOf(addr1.address)).to.equal(5);
      expect(await tomaasLPN.tokenURI(0)).to.equal(tokenURI);
      expect(Addr1Bal).to.equal(ethers.utils.parseUnits("500", 6).mul(1000000));
      expect(ContractBal).to.equal(
        ethers.utils.parseUnits("500", 6).mul(1000000)
      );
    });

    // it("Should fail if a non-owner tries to mint", async function () {
    //   await usdc
    //     .connect(addr1)
    //     .approve(tomaasLPN.address, ethers.utils.parseUnits("10", 1));
    //   await expect(
    //     tomaasLPN.connect(addr1).safeMintMultiple(addr1.address, tokenURI, 1)
    //   ).to.be.revertedWith("Ownable: caller is not the owner");
    // });
  });

  //   describe("Withdraw", () => {
  //     before(async () => {
  //       await usdc
  //         .connect(addr1)
  //         .approve(
  //           tomaasLPN.address,
  //           ethers.utils.parseUnits("100", 6).mul(1000000)
  //         );
  //       await tomaasLPN.connect(addr1).safeMintMultiple(addr1.address, tokenURI, 1);
  //     });
  //     it("Contract USDC Balance", async () => {
  //       expect(await usdc.balanceOf(tomaasLPN.address)).to.equal(
  //         ethers.utils.parseUnits("100", 6).mul(1000000)
  //       );
  //     });
  //     it("Addr1 USDC Balance", async () => {
  //       expect(await usdc.balanceOf(addr1.address)).to.equal(
  //         ethers.utils.parseUnits("900", 6).mul(1000000)
  //       );
  //     });
  //     it("Is Minted", async () => {
  //       expect(await tomaasLPN.balanceOf(addr1.address)).to.equal(1);
  //     });
  //     // it("Withdraw from contract", async () => {});
  //   });
});
