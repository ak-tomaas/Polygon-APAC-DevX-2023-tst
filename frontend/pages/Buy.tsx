import { useEffect, useState } from 'react';
import type { NextPage } from 'next'
import Head from 'next/head'

import { Network, Alchemy } from "alchemy-sdk";
import { ethers } from "ethers";

import LendingJSON from "../contracts/polygon/TomaasLending.json";
import TRNJSON from "../contracts/polygon/TomaasLPN.json";
import USDCABI from "../contracts/polygon/ERC20UpgradeableABI.json";
import MarketplaceJSON from "../contracts/polygon/TomaasMarketplace.json";
import ContractAddressJSON from "../contracts/polygon/contract-address.json";

import Navbar from '../components/navbar';
import SectionTitle from '../components/sectionTitle';
import Footer from '../components/footer';
import DescriptionCard from '../components/descriptionCard';

const settings = {
  apiKey: process.env.ALCHEMY_POLYGON_API_KEY,
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

const Buy: NextPage = ({ data } : any) => {

  type SaleInfoNFT = {
    nftAddr: string,
    tokenId: number,
    name: string,
    description: string,
    image: string,
    seller: string,
    price: string,
    tokenUri: string
  };

  /**
   * ListingForSellingTRN is a collection info  
   * listing is a list of NFTs in the same contract address(collection)
   */
  type ListingForSellingNFT = {
    nftAddr: string,
    listing: SaleInfoNFT[]
  };

  type InfoNFT = {
    nftAddr: string,
    name: string,
    price: number,
    expire: string,
    apr: number,
    aprDuration: string
  }

  /**
   * listingTRN is a list of collections for sale
   */
  const [listingTRN, updateListingTRN] = useState<ListingForSellingNFT[]>([]);

  /**
   * listingTLN is a list of collections for sale
   */
  const [listingTLN, updateListingTLN] = useState<ListingForSellingNFT[]>([]);

  // const [mintTLN, updateMintTLN] = useState<MintInfoTLN>({nftAddr: "", name: "", description: "", image: "", price: ""});
  const [infoTRN, updateInfoTRN] = useState<InfoNFT>({nftAddr: "", name: "", price: 0, expire: "", apr: 0, aprDuration: ""});
  const [infoTLN, updateInfoTLN] = useState<InfoNFT>({nftAddr: "", name: "", price: 0, expire: "", apr: 0, aprDuration: ""});

  const [dataFetched, updateFetched] = useState(false);

  let usdc_decimals = 0;

  async function makeListingTLN(signer: ethers.Signer | ethers.providers.Provider | undefined) {

    let listingForSellingTLN = [] as ListingForSellingNFT[];

    let listingForCollection: ListingForSellingNFT = {
      nftAddr: ContractAddressJSON.TomaasLPN,
      listing: [] as SaleInfoNFT[]
    };

    let tlnContract = new ethers.Contract(ContractAddressJSON.TomaasLPN, TRNJSON.abi, signer);
    let tokenUri = await tlnContract.tokenURI(4);
    console.log("tokenUri : ", tokenUri);

    let tlnMetadata = await alchemy.nft.getNftMetadata(ContractAddressJSON.TomaasLPN, "4");

    console.log("tlnMetadata : ", tlnMetadata);
    let saleInfoTLN: SaleInfoNFT = {
      nftAddr: ContractAddressJSON.TomaasLPN,
      tokenId: 0,
      name: tlnMetadata.title,
      description: tlnMetadata.description,
      image: tlnMetadata.rawMetadata?.image || "",
      seller: "",
      price: "100",
      tokenUri: tlnMetadata?.tokenUri?.raw || "",
    };
    listingForCollection.listing.push(saleInfoTLN);
    listingForSellingTLN.push(listingForCollection);
    console.log("listingForSellingTLN : ", listingForSellingTLN);
    updateListingTLN(listingForSellingTLN);


    let infoTLN: InfoNFT = {
      nftAddr: ContractAddressJSON.TomaasLPN,
      name: "TLN FLO #1",
      price: 100,
      expire: "none",
      apr: 18,
      aprDuration: "fixed"
    };
    updateInfoTLN(infoTLN);
  }

  async function makeListingTRN(signer: ethers.Signer | ethers.providers.Provider | undefined) {
    let lendingContract = new ethers.Contract(ContractAddressJSON.TomaasLending, LendingJSON.abi, signer)
    let marketplaceContract = new ethers.Contract(ContractAddressJSON.TomaasMarketplace, MarketplaceJSON.abi, signer)

    let listingForSellingTRN = [] as ListingForSellingNFT[];

    try {

      let collections = await lendingContract.getCollections();
      console.log("collections length : ", collections.length);

      for (let i = 0; i < collections.length; i++) {
        let trnAddress = collections[i].tomaasRWN;
        let listingForCollection: ListingForSellingNFT = {
          nftAddr: trnAddress,
          listing: [] as SaleInfoNFT[]
        }

        let saleInfos = await marketplaceContract.getListedNFTs(trnAddress);
        if (saleInfos.length === 0) {
          console.log("trnAddress : ", trnAddress, " has no saleInfos");
          continue;
        }

        console.log("saleInfos length : ", saleInfos.length);
        let nftMetadata = await alchemy.nft.getNftMetadata(trnAddress, saleInfos[0].tokenId);
        console.log("nftMetadata : ", nftMetadata);
        saleInfos.map((item: any) => {
          let price = ethers.utils.formatUnits(item.price, usdc_decimals);
          let saleInfoTRN: SaleInfoNFT = {
            nftAddr: trnAddress,
            tokenId: item.tokenId,
            name: nftMetadata.title,
            description: nftMetadata.description,
            image: nftMetadata.rawMetadata?.image || "",
            seller: item.seller,
            price: price,
            tokenUri: nftMetadata?.tokenUri?.raw || "",
          };
          listingForCollection.listing.push(saleInfoTRN);
        });

        listingForSellingTRN.push(listingForCollection);
      }

      console.log("listingForSellingTRN : ", listingForSellingTRN);


      let infoTRN: InfoNFT = {
        nftAddr: listingForSellingTRN[0].nftAddr,
        name: listingForSellingTRN[0].listing[0].name,
        price: parseFloat(listingForSellingTRN[0].listing[0].price) || 0,
        expire: "2024-11-19",
        apr: 0,
        aprDuration: "none"
      };

      let revenue = data.estimatedTotalAmountPerVehice - infoTRN.price;
      let revenuePerYear = revenue / data.lastDeatilReport?.restOfDays * 365 || 0;
      let apr = revenuePerYear / infoTRN.price * 100 || 0;
      let aprDuration = data.startDate + " ~ " + data.endDate;

      infoTRN.apr = parseFloat(apr.toFixed(2));
      infoTRN.aprDuration = aprDuration;
      updateInfoTRN(infoTRN);
    }
    catch (e) {
      console.log("Error : ", e);
      return;
    }

    if (listingForSellingTRN.length > 0) {
      updateListingTRN(listingForSellingTRN);
    }
  }

  async function getAllNFTs() {
    updateFetched(true);
    console.log("getAllNFTs");

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    let addr: string = "";

    try {
      addr = await signer.getAddress();
      if (addr === undefined) {
        console.log("no address");
        return;
      }
    }
    catch (err) {
      console.log(err);
      return;
    }

    console.log("loading contract");

    let usdcContract = new ethers.Contract(ContractAddressJSON.USDC, USDCABI, signer);
    usdc_decimals = await usdcContract.decimals();

    makeListingTRN(signer);
    makeListingTLN(signer);
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
    
    if (!dataFetched)
      getAllNFTs();
  }, []);

  return (
    <>
      <Head>
        <title>Trustless Ondemand shared Mobility As A Service</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Navbar />
      <SectionTitle
        pretitle=""
        title="Mint NFT and Own or Stake it">
          
        <div className="mt-10 max-w-3xl space-y-12 grid grid-cols-1 gap-8 overflow-hidden lg:grid lg:grid-cols-2 lg:space-y-0">
          <div className="flex flex-col bg-white rounded-2xl">
            <h3 className="mt-4 text-2xl font-semibold text-gray-900">Real World Asset NFT</h3>
            <p className="mt-2 text-sm text-gray-500">Rental NFT can prove ownership of a Shared Mobility Device. 
            You can claim a portion of Shared Mobility Device's operating profit every week.</p>
            <DescriptionCard buttonText="Buy TRN" buttonLink="buy" items={listingTRN} nftInfo={infoTRN} />
          </div>
          <div className="flex flex-col bg-white rounded-2xl">
            <h3 className="mt-4 text-2xl font-semibold text-gray-900">Liquidity Provider NFT</h3>
            <p className="mt-2 text-sm text-gray-500">Liquidity NFT can be deposited in the staking pool to earn fixed interest income, it provides liquidity to the staking pool.</p>
            <DescriptionCard buttonText="Mint TLN" buttonLink="mint" items={listingTLN} nftInfo={infoTLN}/>
          </div>
        </div>
      </SectionTitle>
      <SectionTitle
        pretitle=""
        title="What's difference?">
        <p className="mt-2 max-w-3xl text-base text-gray-100">
        Since it is a NFT Protocol Service based on real assets, TomaaS can provide more reliable and transparent revenue sharing than other projects. In addition, TomaaS provides a portion of the Mobility Service revenue as a Rental NFT and can share fixed revenue due to the Staking Pool, thereby minimizing revenue volatility.
        </p>
      </SectionTitle>

      <Footer />
    </>
  );
}

export default Buy
