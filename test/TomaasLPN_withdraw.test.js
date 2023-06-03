const { expect } = require("chai");
const { ethers } = require("hardhat");
let usdc;
let TomaasLPN, tomaasLPN, owner, addr1;

describe("Withdraw", () => {
  before(async () => {
    [owner, addr1] = await ethers.getSigners();
    let tokenURI = "https://ipfs.io/ipfs/Qm..."; // Add your tokenURI here
    const USDC_UNIT = ethers.utils.parseUnits("1000", 6).mul(1000000);
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

    await usdc
      .connect(addr1)
      .approve(
        tomaasLPN.address,
        ethers.utils.parseUnits("100", 6).mul(1000000)
      );
    await tomaasLPN.connect(addr1).safeMintMultiple(addr1.address, tokenURI, 1);
  });

  it("Contract USDC Balance is 100", async () => {
    expect(await usdc.balanceOf(tomaasLPN.address)).to.equal(
      ethers.utils.parseUnits("100", 6).mul(1000000)
    );
  });

  it("Addr1 USDC Balance is 900", async () => {
    expect(await usdc.balanceOf(addr1.address)).to.equal(
      ethers.utils.parseUnits("900", 6).mul(1000000)
    );
  });

  it("A NFT is Minted to addr1", async () => {
    expect(await tomaasLPN.balanceOf(addr1.address)).to.equal(1);
  });

  it("addr1(POOL CONTRACT) is added to WL", async () => {
    await tomaasLPN.connect(owner).addToWL(addr1.address);
    expect(await tomaasLPN.isWL(addr1.address)).to.equal(true);
  });

  it("addr1(POOL CONTRACT) withdraws tokens of NFT:id(0) from contract", async () => {
    await tomaasLPN.connect(addr1).withdraw(0);
    expect(await usdc.balanceOf(addr1.address)).to.equal(
      ethers.utils.parseUnits("1000", 6).mul(1000000)
    );
  });

  it("Token balance of NFT is 0", async () => {
    expect(await tomaasLPN.getTokenBalOfNFT(0)).to.equal(0);
  });

  it("withdraw multiple tokens", async () => {
    await tomaasLPN.connect(owner).addToWL(addr1.address);
    const tokenURI = "aaaa";
    await usdc
      .connect(addr1)
      .approve(
        tomaasLPN.address,
        ethers.utils.parseUnits("500", 6).mul(1000000)
      );
    await tomaasLPN.connect(addr1).safeMintMultiple(addr1.address, tokenURI, 5);

    await tomaasLPN.connect(addr1).withdrawMultiple([1, 2, 3, 4]);
    expect(await usdc.balanceOf(addr1.address)).to.equal(
      ethers.utils.parseUnits("900", 6).mul(1000000)
    );
  });

  it("should failed because token has not enough balance", async () => {
    await tomaasLPN.connect(owner).addToWL(addr1.address);
    await expect(tomaasLPN.connect(addr1).withdrawMultiple([1])).to.be.revertedWith("token has no balance");
  });

  it("should failed not owner", async () => {
    await tomaasLPN.connect(owner).addToWL(addr1.address);
    const [addr2] = await ethers.getSigners();
    await usdc
      .connect(owner)
      .mint(addr2.address, ethers.utils.parseUnits("1000", 6).mul(1000000));

    await usdc
      .connect(addr2)
      .approve(
        tomaasLPN.address,
        ethers.utils.parseUnits("200", 6).mul(1000000)
      );
    await tomaasLPN.connect(addr2).safeMintMultiple(addr2.address, "", 2);
    await expect(tomaasLPN.connect(addr1).withdrawMultiple([6, 7])).to.be.revertedWith("You entered a tokenId that is not yours");
  });
});
