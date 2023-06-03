import { useEffect, useState } from 'react';

import type { NextPage } from 'next'
import Head from 'next/head'

import { Network, Alchemy } from "alchemy-sdk";
import { ethers } from "ethers";

import ContractAddressJSON from "../contracts/sepolia/contract-address.json";
import USDCABI from "../contracts/sepolia/ERC20UpgradeableABI.json";
import LendingJSON from "../contracts/sepolia/TomaasLending.json";
import TomaasRWNJSON from "../contracts/sepolia/TomaasRWN.json";

import Navbar from '../components/navbar';
import SectionTitle from '../components/sectionTitle';
import Footer from '../components/footer';

const settings = {
  apiKey: "mjigLH16AH2bdolh5gDPf-Ef5SCemJJx",
  network: Network.ETH_SEPOLIA,
};

const alchemy = new Alchemy(settings);

export async function getServerSideProps() {
  // Fetch data from external API
  const res = await fetch('https://arweave.net/ALCH6lkM7zhMUa7XXQDXz8DH_O1JfS4SB6EhFhlV42c')
  const data = await res.json()

  // Pass data to the page via props
  return { props: { data } }
}

const Lend: NextPage = ({ data } : any) => {

  const [trnContract, setTrnContract] = useState<ethers.Contract | null>(null);
  // const [lendingContract, setLendingContract] = useState<ethers.Contract | null>(null);
  // const [usdcContract, setUsdcContract] = useState<ethers.Contract | null>(null);

  // const [decimals, setDecimals] = useState(0);
  const [walletAddr, setWalletAddr] = useState("0x");

  const [amountOfRented, setAmountOfRented] = useState(0);
  const [amountOfUnrented, setAmountOfUnrented] = useState(0);
  const [remainingRewards, setRemainingRewards] = useState(0);
  const [rewardsOverTheYear, setRewardsOverTheYear] = useState("");
  const [totalSupply, setTotalSupply] = useState("");

  async function loadTRN(signer: ethers.Signer, decimals: number) {
    let trnContract:any = null;
    try {
      trnContract = new ethers.Contract(
        ContractAddressJSON.TomaasRWN,
        TomaasRWNJSON.abi,
        signer);
      setTrnContract(trnContract);
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
      addr = await signer.getAddress();
      console.log("walletAddr is 0x");
    }

    let amountOfRented = 0;
    let ownedNFTs = await alchemy.nft.getNftsForOwner(addr, {contractAddresses:[ContractAddressJSON.TomaasRWN]});

    console.log("ownedNFTs : ", ownedNFTs);
    let countOfOwnedNFTs = ownedNFTs.totalCount;

    if (countOfOwnedNFTs > 0) {
      const ownedNFTsArray = ownedNFTs.ownedNfts;
      await Promise.all(ownedNFTsArray.map(async (nft: any) => {
        try {
          let user = await trnContract.userOf(nft.tokenId);
          console.log("user : ", user);
          if (user !== ethers.constants.AddressZero) {
            amountOfRented++;
          }
        }
        catch (err) {
          console.log("loadTRN error : ", err);
        }
      }));
    }
    console.log("amountOfRented : ", amountOfRented);
    let amountOfUnrented = countOfOwnedNFTs - amountOfRented;
    console.log("amountOfUnrented : ", amountOfUnrented);
    setAmountOfUnrented(amountOfUnrented);
    setAmountOfRented(amountOfRented);

    let remainingRewards = await trnContract.unClaimedEarningsAll();
    remainingRewards = ethers.utils.formatUnits(remainingRewards, decimals);
    remainingRewards = (Number(remainingRewards).toFixed(2)).toLocaleString();
    console.log("remainingRewards : ", remainingRewards);
    setRemainingRewards(remainingRewards);

    let totalSupply = await trnContract.totalSupply();
    console.log("totalSupply : ", totalSupply.toString());
    setTotalSupply(Number(totalSupply).toLocaleString());
  }

  async function loadLending(signer: ethers.Signer, decimals: number) {
    let lendingContract = new ethers.Contract(
                                        ContractAddressJSON.TomaasLending,
                                        LendingJSON.abi,
                                        signer);
    if (lendingContract === null) {
      console.log("lendingContract is null");
      return;
    }
    // setLendingContract(lendingContract);
    //let reportList = await lendingContract.getSettlementReportsFromLast(walletAddr);
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
    // setUsdcContract(usdcContract);

    let usdcDecimals = await usdcContract.decimals();
    console.log("usdcDecimals : ", usdcDecimals.toString());
    // setDecimals(usdcDecimals);

    let totalSettlementSum = data.totalSettlementSum / data.lastDeatilReport.exchangeRate;
    console.log("totalSettlementSum : ", totalSettlementSum);
    let usdTotal = Number(totalSettlementSum.toFixed(2)).toLocaleString();
    setRewardsOverTheYear(usdTotal);

    await loadTRN(signer, usdcDecimals);
    await loadLending(signer, usdcDecimals);
  }

  async function doClaim() {
    if (trnContract === null) {
      console.log("trnContract is null");
      return;
    }
    await trnContract.claimEarningsAllRented();
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
    // loadTRN();
  }, []);

  return (
    <>
      <Head>
        <title>Trustless Ondemand shared Mobility As A Service</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Navbar />
      <SectionTitle align="left"
        pretitle="Current currency amount of pool"
        title="USDC $99,999">
        <div className="pool-box mt-3 max-w-xl grid grid-cols-2 overflow-hidden rounded-2xl">
          <div className="pl-16 py-8 flex flex-col bg-white/70">
            <p className="mt-1 text-sm text-gray-500">Rewards over the year</p>
            <h3 className="mt-1 text-base font-semibold text-gray-900">{rewardsOverTheYear} USDC</h3>
          </div>
          <div className="py-8 flex flex-col bg-white/70">
            <p className="mt-1 text-sm text-gray-500">Total rented NFT</p>
            <h3 className="mt-1 text-base font-semibold text-gray-900">{totalSupply} amount</h3>
          </div>
        </div>
      </SectionTitle>
      <SectionTitle align="left"
        pretitle=""
        title="Lending">
          <div className='grid grid-cols-10 gap-4'>
            <div className='staking-block flex flex-col col-start-1 col-end-5 p-4 bg-white rounded-2xl'>
              <h2 className='text-gray-900'>My Lending</h2>
              <div className='grid grid-cols-2 mt-4'>
                <div className='reward'>
                  <p className='text-sm text-gray-500'>Present Reward</p>
                  <span className='text-base font-semibold text-gray-900'>{remainingRewards} USDC</span>
                </div>
                <div className='deposit flex flex-col bg-violet-200 py-1 pr-4  text-right rounded-xl'>
                  <p className='text-sm text-gray-500'>Amount of Rented NFT</p>
                  <span className='text-base font-semibold text-violet-700'>{amountOfRented} amount</span>
                </div>
              </div>
              <div className='staking-btn mt-6 py-2'> 
                <div onClick={() => doClaim()} className="flex flex-col border-2 mt-2 py-2 font-light
                    border-violet-700 w-full text-center text-white bg-violet-700 rounded-full
                    hover:text-violet-700 hover:bg-white hover:border-2 hover:border-violet">
                Claim rewards
                </div>
                <span className="flex flex-col border-2 mt-2 py-1 font-light 
                    border-gray-300 w-full text-center text-white bg-gray-300 rounded-full">
                Add lending
                </span>
                <span className="flex flex-col w-full text-center rounded-full
                    text-gray-300 mt-2 py-2 font-light">
                Stop lending
                </span>
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
                    <p className='text-sm'>Amount of Rentalable NFT</p>
                    <span className='text-base font-semibold text-gray-100'>{amountOfUnrented} amount</span>
                  </div>
                  <div className='flex flex-col'>
                    <p className='text-sm'>Amount of Rented NFT</p>
                    <span className='text-base font-semibold text-gray-100'>{amountOfRented} amount</span>
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

export default Lend
