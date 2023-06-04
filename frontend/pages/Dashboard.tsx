import type { NextPage } from 'next'
import Head from 'next/head'

import { Network, Alchemy } from "alchemy-sdk";
import { ethers } from "ethers";

import Navbar from '../components/navbar';
import SectionTitle from '../components/sectionTitle';
import Footer from '../components/footer';
import Container from "../components/container";

import ContractAddressJSON from "../contracts/polygon/contract-address.json";
import ERC20Mock from "../contracts/polygon/ERC20Mock.json";
import TomaasRWNJSON from "../contracts/polygon/TomaasRWN.json";
import TomaasLPNJSON from "../contracts/polygon/TomaasLPN.json";
import StakingJSON from "../contracts/polygon/TomaasStaking.json";

import { useEffect, useState } from 'react';

const settings = {
  apiKey: process.env.ALCHEMY_POLYGON_API_KEY,
  network: Network.MATIC_MAINNET,
};

const alchemy = new Alchemy(settings);

const Dashboard: NextPage = () => {

  const [walletAddr, setWalletAddr] = useState('0x');
  const [usdcContract, setUSDCContract] = useState<any>(null);
  const [decimals, setDecimals] = useState(0);
  const [myBalance, setMyBalance] = useState(0);
  const [remainingTRNRewards, setRemainingTRNRewards] = useState(0);
  const [amountOfTRNs, setAmountOfTRNs] = useState(0);
  const [remainingTLNRewards, setRemainingTLNRewards] = useState(0);
  const [amountOfTLNs, setAmountOfTLNs] = useState(0);
  const [isDeployer, setIsDeployer] = useState(false);
  const [stakingContract, setStakingContract] = useState<any>(null);

  async function loadTRN(signer: ethers.Signer, decimals: number) {
    let trnContract:any = null;
    try {
      trnContract = new ethers.Contract(
        ContractAddressJSON.TomaasRWN,
        TomaasRWNJSON.abi,
        signer);
    }
    catch(err) {
      console.log("loadTRN error : ", err);
    }

    if (trnContract === null) {
      console.log("trnContract is null");
      return;
    } 
    
    let addr;
    if (walletAddr !== "0x") {
      addr = walletAddr;
    }
    else {
      try {
        addr = await signer.getAddress();
      }
      catch(err) {
        console.log("getAddress error : ", err);
        return;
      }
    }

    let ownedNFTs = await alchemy.nft.getNftsForOwner(addr, {contractAddresses:[ContractAddressJSON.TomaasRWN]});

    let countOfOwnedNFTs = ownedNFTs.totalCount;
    setAmountOfTRNs(countOfOwnedNFTs);

    let remainingRewards = await trnContract.unClaimedEarningsAll();
    remainingRewards = ethers.utils.formatUnits(remainingRewards, decimals);
    remainingRewards = (Number(remainingRewards).toFixed(2)).toLocaleString();
    console.log("remainingRewards : ", remainingRewards);
    setRemainingTRNRewards(remainingRewards);
  }

  async function loadTLN(signer: ethers.Signer, decimals: number) {
    let tlnContract:any = null;
    try {
      tlnContract = new ethers.Contract(
        ContractAddressJSON.TomaasLPN,
        TomaasLPNJSON.abi,
        signer);
    }
    catch(err) {
      console.log("loadTLN error : ", err);
    }

    if (tlnContract === null) {
      console.log("trnContract is null");
      return;
    }
    let addr;
    try {
      addr = await signer.getAddress();
    }
    catch(err) {
      console.log("getAddress error : ", err);
      return;
    }

    let ownedNFTs = await alchemy.nft.getNftsForOwner(addr, {contractAddresses:[ContractAddressJSON.TomaasLPN]});
    let countOfOwnedNFTs = ownedNFTs.totalCount;
    console.log("countOf ", countOfOwnedNFTs ,"ownedNFTs : ", ownedNFTs);
    setAmountOfTLNs(countOfOwnedNFTs); 
  }

  async function loadStaking(signer: ethers.Signer, decimals: number) {
    let stakingContract:any = null;
    try {
      stakingContract = new ethers.Contract(
        ContractAddressJSON.TomaasStaking,
        StakingJSON.abi,
        signer);
    }
    catch(err) {
      console.log("loadStaking error : ", err);
    }

    if (stakingContract === null) {
      console.log("stakingContract is null");
      return;
    }
    let addr;
    if (walletAddr !== "0x") {
      addr = walletAddr;
    }
    else {
      console.log("walletAddr is 0x");
      try {
        addr = await signer.getAddress();
      }
      catch(err) {
        console.log("getAddress error : ", err);
        return;
      }
    }
    console.log("addr : ", addr); 
    //deployer address
    if (addr === "0xE6F198cDE0c86eD557c0016E3b179C4B1A4Cc6c7") {
      setIsDeployer(true);
    }

    let remainingRewards = await stakingContract.remainingRewards(ContractAddressJSON.TomaasLPN);
    console.log("remainingRewards : ", remainingRewards.toString());
    setRemainingTLNRewards(remainingRewards.toString()); 

    setStakingContract(stakingContract);
  }

  const mintUSDC = async () => {
    console.log("decimals: ", decimals);
    let price = ethers.utils.parseUnits("3000", decimals);
    console.log("price: ", price.toString());
    try {
      await usdcContract.mint(walletAddr, price);
    }
    catch (err) {
      console.log(err);
      alert(err);
    }
  }

  const buyTRNsFromList = async () => {
    try {
      await stakingContract.buyTRNsFromList(ContractAddressJSON.TomaasRWN);
    }
    catch (err) {
      console.log(err);
      alert(err);
    }
  }

  const claimFromTRNs = async () => {
    try {
      await stakingContract.claimFromTRNs(ContractAddressJSON.TomaasRWN, {gasPrice: 100000000});
    }
    catch (err) {
      console.log(err);
      alert(err);
    }
  }

  async function loadContract() {
    let provider;
    let signer;
    let addr: string = "";

    try {
      provider = new ethers.providers.Web3Provider(window.ethereum);
      signer = provider.getSigner();
      addr = await signer.getAddress();
      if (addr === undefined) {
        console.log("no address");
        return;
      }
      setWalletAddr(addr);
    }
    catch (err) {
      console.log(err);
      return;
    }

    console.log("loading usdc contract ", ContractAddressJSON.USDC);
    let usdcContract;
    let usdcDecimals = 0;

    try {
      usdcContract = new ethers.Contract(ContractAddressJSON.USDC, ERC20Mock.abi, signer);
      setUSDCContract(usdcContract);
      usdcDecimals = await usdcContract.decimals();
      console.log("usdcDecimals : ", usdcDecimals.toString());
      setDecimals(usdcDecimals);
    }
    catch (err) {
      console.log(err);
      return;
    }

    let myBalance = await usdcContract.balanceOf(addr);
    myBalance = ethers.utils.formatUnits(myBalance, usdcDecimals);
    setMyBalance(myBalance);
    console.log("myBalance : ", myBalance.toString());

    loadTRN(signer, usdcDecimals);
    loadTLN(signer, usdcDecimals);
    loadStaking(signer, usdcDecimals);
  }

  useEffect(() => {
    if (window.ethereum === undefined) {
      console.log("there isn't crypto wallet");
      return;
    }

    let val = window.ethereum.isConnected();
    if (val) {
      console.log("ethereum is connected");
    }
    loadContract();  
  }, []);

  return (
    <>
      <Head>
        <title>Trustless Ondemand shared Mobility As A Service</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Navbar />
      <SectionTitle align="left"
        pretitle=""
        title="My Dashboard">
        <div className='account-box pl-16 py-8 max-w-xl rounded-2xl bg-white/70'>
          <h1 className='flex flex-col text-gray-800'>Account</h1>
          <div className="mt-3 grid grid-cols-2 overflow-hidden ">
            <div className="flex flex-col">
              <p className="mt-1 text-sm text-gray-500">My USDC</p>
              <h3 className="mt-1 text-base font-semibold text-gray-900">{myBalance} USDC</h3>
            </div>
            <div className="flex flex-col">
              <p className="mt-1 text-sm text-gray-500"></p>
              <h3 className="mt-1 text-base font-semibold text-gray-900"></h3>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 overflow-hidden ">
            <div className="flex flex-col">
              <p className="mt-1 text-sm text-gray-500">TRN Avaliable rewards</p>
              <h3 className="mt-1 text-base font-semibold text-gray-900">{remainingTRNRewards} USDC</h3>
            </div>
            <div className="flex flex-col">
              <p className="mt-1 text-sm text-gray-500">My TRNs</p>
              <h3 className="mt-1 text-base font-semibold text-gray-900">{amountOfTRNs} amount</h3>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 overflow-hidden ">
            <div className="flex flex-col">
              <p className="mt-1 text-sm text-gray-500">TLN Avaliable rewards</p>
              <h3 className="mt-1 text-base font-semibold text-gray-900">{remainingTLNRewards} USDC</h3>
            </div>
            <div className="flex flex-col">
              <p className="mt-1 text-sm text-gray-500">My TLNs</p>
              <h3 className="mt-1 text-base font-semibold text-gray-900">{amountOfTLNs} amount</h3>
            </div>
          </div>
        </div>
      </SectionTitle>
      <Container>
        <button onClick={mintUSDC} className="flex flex-col border-2 font-light w-48 max-w-xs -my-16 items-center
                    border-red-500 w-full text-center text-white bg-red-500 rounded-full
                    hover:text-red-500 hover:bg-white hover:border-2 hover:border-violet">
          Mint USDC for testing
        </button> 
      </Container>
      {
          isDeployer == true ? (
            <Container>
            <button onClick={buyTRNsFromList} className="flex flex-col border-2 font-light w-48 max-w-xs items-center
                    border-blue-500 text-center text-white bg-blue-500 rounded-full
                    hover:text-blue-500 hover:bg-white hover:border-2 hover:border-violet">
                Buy TRNs from list
            </button>
            <button onClick={claimFromTRNs} className="flex flex-col border-2 font-light w-48 mt-4 max-w-xs items-center
                    border-blue-500 text-center text-white bg-blue-500 rounded-full
                    hover:text-blue-500 hover:bg-white hover:border-2 hover:border-violet">
                Claim from TRNs
            </button>
            </Container>
          ) : null
        }
      <SectionTitle align="left"
        pretitle=""
        title="">
        <div className="history-box grid grid-cols-2 overflow-hidden ">
          <div className="flex flex-col m-2">
            <h1 className='text-gray-100 text-2xl'>My Reward</h1>
            <div className="reward-history mt-8 flow-root">
              <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-white">
                      <tr>
                        <th scope="col" className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Token Name</th>
                        <th scope="col" className="whitespace-nowrap px-2 py-3.5 text-left text-sm font-semibold text-gray-900">Quantity Hold</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-gray-100 sm:pl-0">USDC</td>
                        <td className="whitespace-nowrap px-2 py-2 text-sm font-medium text-gray-100">$9,999</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col m-2">
            <h1 className='text-gray-100 text-2xl'>Claim History</h1>
            <div className="claim-history mt-8 flow-root">
              <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-white">
                      <tr>
                        <th scope="col" className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Claim Date</th>
                        <th scope="col" className="whitespace-nowrap px-2 py-3.5 text-left text-sm font-semibold text-gray-900">Token</th>
                        <th scope="col" className="whitespace-nowrap px-2 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 ">
                      <tr>
                        <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-gray-100 sm:pl-0">2023-05-17 10:46:22</td>
                        <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-gray-100 sm:pl-0">USDC</td>
                        <td className="whitespace-nowrap px-2 py-2 text-sm font-medium text-gray-100">Approve</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionTitle>
      <Footer />
    </>
  );
}

export default Dashboard
