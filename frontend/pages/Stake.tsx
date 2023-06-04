import { useEffect, useState } from 'react';
import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link';

import { Network, Alchemy } from "alchemy-sdk";
import { ethers } from "ethers";

import ContractAddressJSON from "../contracts/polygon/contract-address.json";
import USDCABI from "../contracts/polygon/ERC20UpgradeableABI.json";
import TomaasRWNJSON from "../contracts/polygon/TomaasRWN.json";
import TomaasLPNJSON from "../contracts/polygon/TomaasLPN.json";
import StakingJSON from "../contracts/polygon/TomaasStaking.json";

import Navbar from '../components/navbar';
import Hero from '../components/hero';
import SectionTitle from '../components/sectionTitle';
import Footer from '../components/footer';

const settings = {
  apiKey: "mjigLH16AH2bdolh5gDPf-Ef5SCemJJx",
  network: Network.MATIC_MAINNET,
};

const alchemy = new Alchemy(settings);

export async function getServerSideProps() {
  // Fetch data from external API
  const res = await fetch('https://arweave.net/ALCH6lkM7zhMUa7XXQDXz8DH_O1JfS4SB6EhFhlV42c')
  const data = await res.json()

  // Pass data to the page via props
  return { props: { data } }
}

const Stake: NextPage = ({ data } : any) => {

  const [stakingContract, setStakingContract] = useState<ethers.Contract | null>(null);

  const [walletAddr, setWalletAddr] = useState("0x");
  const [totalRewards, setTotalRewards] = useState("");
  const [amountOfTLNS, setAmountOfTLNS] = useState("");
  const [amountOfStaked, setAmountOfStaked] = useState(0);
  const [remainingRewards, setRemainingRewards] = useState(0);
  const [countOfOwnedNFTs, setCountOfOwnedNFTs] = useState(0);
  const [totalLockedRewards, setTotalLockedRewards] = useState("-");

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
    catch(e) {
      console.log("getAddress error : ", e);
      return;
    }
    let ownedNFTs = await alchemy.nft.getNftsForOwner(addr, {contractAddresses:[ContractAddressJSON.TomaasLPN]});
    let countOfOwnedNFTs = ownedNFTs.totalCount;
    console.log("countOf ", countOfOwnedNFTs ,"ownedNFTs : ", ownedNFTs);
    setCountOfOwnedNFTs(countOfOwnedNFTs);

    let listOfTLNs = await alchemy.nft.getNftsForContract(ContractAddressJSON.TomaasLPN);
    console.log("Count of listOfTLNs : ", listOfTLNs.nfts.length);
    let localAmountOfTLNS = Number(listOfTLNs.nfts.length).toLocaleString(); 
    setAmountOfTLNS(localAmountOfTLNS);

  }

  async function loadStaking(signer: ethers.Signer, decimals: number) {
    let stakingContract:any = null;
    try {
      stakingContract = new ethers.Contract(
        ContractAddressJSON.TomaasStaking,
        StakingJSON.abi,
        signer);
      setStakingContract(stakingContract);
    }
    catch(err) {
      console.log("loadStaking error : ", err);
    }

    if (stakingContract === null) {
      console.log("stakingContract is null");
      return;
    }

    let addr;
    try {
      addr = await signer.getAddress();
    }
    catch(e) {
      console.log("get address error : ", e);
      return;
    }

    try {
      let listOfTLNsStaked = await stakingContract.listOfTLNs(ContractAddressJSON.TomaasLPN);
      let amountOfStaked = listOfTLNsStaked.length;
      console.log("amountOfStaked : ", amountOfStaked.toString());
      setAmountOfStaked(amountOfStaked);
    }
    catch(e) {
      console.log("listOfTLNs error : ", e);
    }

    try {
      let remainingRewards = await stakingContract.remainingRewards(ContractAddressJSON.TomaasLPN);
      remainingRewards = ethers.utils.formatUnits(remainingRewards, decimals);
      console.log("remainingRewards : ", remainingRewards.toString());
      setRemainingRewards(remainingRewards.toString());
    }
    catch(e) {
      console.log("remainingRewards error : ", e);
    }

    try {
      let totalClaimedRewards = await stakingContract.totalClaimedRewards();
      totalClaimedRewards = ethers.utils.formatUnits(totalClaimedRewards, decimals);
      totalClaimedRewards = Number(totalClaimedRewards).toFixed(2);
      setTotalLockedRewards(totalClaimedRewards.toLocaleString());
      console.log("totalLockedRewards : ", totalClaimedRewards.toString());
    }
    catch(e) {
      console.log("totalClaimedRewards error : ", e);
    }

  }

  async function loadContract() {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    let addr: string = "";

    try {
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

    console.log("loading contract");

    let usdcContract = new ethers.Contract(ContractAddressJSON.USDC, USDCABI, signer);

    let usdcDecimals = await usdcContract.decimals();
    console.log("usdcDecimals : ", usdcDecimals.toString());

    let amountOfVehicle = data.lastDeatilReport.amountOfVehicle;
    let amountOfTLNS = amountOfVehicle * 300 / 100
    let totalTLNRewards = amountOfTLNS * 100 * 0.18;

    let usdTotal = Number(totalTLNRewards.toFixed(2)).toLocaleString();
    // let localAmountOfTLNS = Number(amountOfTLNS.toFixed(2)).toLocaleString();
    setTotalRewards(usdTotal);
    // setAmountOfTLNS(localAmountOfTLNS);

    await loadTLN(signer, usdcDecimals);
    await loadStaking(signer, usdcDecimals);
  }

  async function doClaim() {
    if (stakingContract === null) {
      console.log("trnContract is null");
      return;
    }
    await stakingContract.claim(ContractAddressJSON.TomaasLPN);
  }

  async function doUnstake() {
    if (stakingContract === null) {
      console.log("trnContract is null");
      return;
    }
    let listOfTLNsStaked = await stakingContract.listOfTLNs(ContractAddressJSON.TomaasLPN);
    await stakingContract.unStakeTLN(ContractAddressJSON.TomaasLPN, listOfTLNsStaked[0]);
  }

  async function doStake(count: number) {
    if (stakingContract === null) {
      console.log("trnContract is null");
      return;
    }
    let listOfTLNsStaked = await stakingContract.listOfTLNs(ContractAddressJSON.TomaasLPN);
    let tokenIds = listOfTLNsStaked.slice(0, count);
    await stakingContract.stakeTLNs(ContractAddressJSON.TomaasLPN, tokenIds);
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
        pretitle="Total Locked Rewards"
        title={totalLockedRewards}>
        <div className="pool-box mt-3 max-w-xl grid grid-cols-2 overflow-hidden rounded-2xl">
          <div className="pl-16 py-8 flex flex-col bg-white/70">
            <p className="mt-1 text-sm text-gray-500">Rewards over the year</p>
            <h3 className="mt-1 text-base font-semibold text-gray-900">{totalRewards} USDC</h3>
          </div>
          <div className="py-8 flex flex-col bg-white/70">
            <p className="mt-1 text-sm text-gray-500">Total TLN amount</p>
            <h3 className="mt-1 text-base font-semibold text-gray-900">{amountOfTLNS} amount</h3>
          </div>
        </div>
      </SectionTitle>
      <SectionTitle align="left"
        pretitle=""
        title="Staking">
          <div className='grid grid-cols-10 gap-4'>
            <div className='staking-block flex flex-col col-start-1 col-end-5 p-4 bg-white rounded-2xl'>
              <h2 className='text-gray-900'>My Staking</h2>
              <div className='grid grid-cols-2 mt-4'>
                <div className='reward'>
                  <p className='text-sm text-gray-500'>Present Reward</p>
                  <span className='text-base font-semibold text-gray-900'>{remainingRewards} USDC</span>
                </div>
                <div className='deposit flex flex-col bg-violet-200 py-1 pr-4  text-right rounded-xl'>
                  <p className='text-sm text-gray-500'>Amount of staked NFT</p>
                  <span className='text-base font-semibold text-violet-700'>{amountOfStaked} amount</span>
                </div>
              </div>
              <div className='staking-btn mt-6 py-2'> 
                {
                  remainingRewards > 0 ? (
                  <div onClick={() => doClaim()} className="flex flex-col border-2 mt-2 py-2 font-light
                    border-violet-700 w-full text-center text-white bg-violet-700 rounded-full
                    hover:text-violet-700 hover:bg-white hover:border-2 hover:border-violet">
                  Claim rewards
                  </div>
                  ) : (
                    <div className="flex flex-col border-2 mt-2 py-2 font-light
                      border-gray-300 w-full text-center text-white bg-gray-300 rounded-full">
                    Claim rewards
                    </div>
                  )
                }
                {
                  countOfOwnedNFTs - amountOfStaked > 0  ? (
                    <div onClick={() => doStake(1)}className="flex flex-col border-2 mt-2 py-1 font-light
                      border-violet-700 w-full text-center text-white bg-violet-700 rounded-full
                      hover:text-violet-700 hover:bg-white hover:border-2 hover:border-violet">
                    Staking
                    </div>
                  ) : (
                    <div className="flex flex-col border-2 mt-2 py-1 font-light
                      border-gray-300 w-full text-center text-white bg-gray-300 rounded-full">
                    Staking
                    </div>
                  )
                }
                {
                  amountOfStaked > 0 ? (
                  <div onClick={() => doUnstake()} className="flex flex-col w-full text-center rounded-full
                    text-red-500 mt-2 py-2 font-light
                    hover:text-white hover:bg-red-500">
                    Unstaking
                  </div>
                  ) : (
                    <div className="flex flex-col w-full text-center rounded-full
                    bg-gray-300 text-white mt-2 py-2 font-light">
                    Unstaking
                    </div>
                  )
                }
              </div>
            </div>
            <div className='state-block flex flex-col col-start-5 col-end-11 '>
              <div className='p-4 flex flex-col bg-black/0 text-gray-100 rounded-2xl h-1/2 border border-2'>
                <h2 className='pb-2 text-gray-100'>Owned NFT</h2>
                <p className='text-sm'>You can check your NFT</p>
              </div>
              <div className='mt-4 p-4 flex flex-col bg-black/0 text-gray-100 rounded-2xl h-1/2 border border-2'>
                <h2 className='pb-2 text-gray-100 mb-4'>My State</h2>
                <div className='grid grid-cols-4 gap-4'>
                  <div className='flex flex-col'>
                    <p className='text-sm'>Amount of Stakeable NFT</p>
                    <span className='text-base font-semibold text-gray-100'>{countOfOwnedNFTs - amountOfStaked} amount</span>
                  </div>
                  <div className='flex flex-col'>
                    <p className='text-sm'>Amount of Staked NFT</p>
                    <span className='text-base font-semibold text-gray-100'>{amountOfStaked} amount</span>
                  </div>
                  <div className='flex flex-col'>
                    <p className='text-sm'>Available Withdraw Reward</p>
                    <span className='text-base font-semibold text-gray-100'>{remainingRewards} USDC</span>
                  </div>
                  <div className='flex flex-col'>
                    <p className='text-sm'>My Accumulated Withdraw Amount</p>
                    <span className='text-base font-semibold text-gray-100'>- USDC</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </SectionTitle>
      <SectionTitle align="left"
        pretitle=""
        title="Transaction history">
        <div className="transaction-history mt-8 flow-root">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr className='bg-white'>
                    <th scope="col" className="whitespace-nowrap py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">Feature</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3.5 text-left text-sm font-semibold text-gray-900">Address</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="whitespace-nowrap py-2 pl-4 pr-3 text-sm text-gray-900 sm:pl-0">Deposit</td>
                    <td className="whitespace-nowrap px-2 py-2 text-sm font-medium text-gray-900">0x5e6cd747...73437aded3</td>
                    <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-900">2023-05-17 10:46:22</td>
                    <td className="whitespace-nowrap px-2 py-2 text-sm text-gray-900">Approve</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SectionTitle>
      <Footer />
    </>
  );
}

export default Stake
