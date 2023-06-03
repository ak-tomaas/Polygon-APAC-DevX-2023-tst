import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import Navbar from '../components/navbar';
import Hero from '../components/hero';
import SectionTitle from '../components/sectionTitle';
import Footer from '../components/footer';

import forServiceProviderImg from "../public/for_service_provider.png";
import forServiceUserImg from "../public/for_service_user.png";
import forInvestorImg from "../public/for_investor.png";
import buyNFT from "../public/buy_nft.png";
import stakeNFT from "../public/stake_nft.png";
import getReward from "../public/get_reward.png";
import howTomaasMakesRewards from "../public/how_tomaas_makes_rewards.png";

export async function getServerSideProps() {
  // Fetch data from external API
  const res = await fetch('https://arweave.net/ALCH6lkM7zhMUa7XXQDXz8DH_O1JfS4SB6EhFhlV42c')
  const data = await res.json()

  // Pass data to the page via props
  return { props: { data } }
}

const Home: NextPage = ({ data } : any) => {
  //get total info

  return (
    <>
      <Head>
        <title>Trustless Ondemand shared Mobility As A Service</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Navbar />
      <Hero totalInfo={data} />
      <SectionTitle
        title="Why TomaaS?">
        <p className='text-gray-200'>TomaaS can solve the above problems through Real World-based NFT Service.</p>
        <div className="mt-4 space-y-12 lg:grid lg:grid-cols-3 lg:gap-x-8 lg:space-y-0">
          <div className="group block">
            <Image className="mx-auto my-8" src={forServiceProviderImg} alt="for_service_provider" width="150" height="150" />
            <h3 className="mt-4 text-2xl font-semibold text-gray-100 ">For Service Provider</h3>
            <p className="mt-2 text-sm text-gray-200">Resolving Service Provider's Funding Issues through NFT Sale</p>
          </div>
          <div className="group block">
            <Image className="mx-auto my-8" src={forServiceUserImg} alt="for_service_user" width="250" height="250" />
            <h3 className="mt-4 text-2xl font-semibold text-gray-100">For Service User</h3>
            <p className="mt-2 text-sm text-gray-200">Lock-in effect for users through incentive provision and gift card</p>
          </div>
          <div className="group block">
            <Image className="mx-auto my-8" src={forInvestorImg} alt="for_investor" width="150" height="150" />
            <h3 className="mt-4 text-2xl font-semibold text-gray-100">For Investor</h3>
            <p className="mt-2 text-sm text-gray-200">Transparent provision of interest income sources through Blockchain and Real World-based assets</p>
          </div>
        </div>
      </SectionTitle>
      <SectionTitle
        title="How it works?">
        <p className='text-gray-100'>Mint TomaaS NFT to Own & Stake</p>
        <div className="mt-10 gap-4 space-y-12 grid grid-cols-1 overflow-hidden lg:grid lg:grid-cols-3 lg:space-y-0">
          <div className="flex flex-col p-4 bg-white/20 rounded-2xl">
            <h3 className="mt-4 text-2xl font-bold text-gray-100">Buy NFT</h3>
            <Image className="mx-auto my-12" src={buyNFT} alt="buy NFT" width="297" height="253" />
            <p className="mt-2 text-semibold text-gray-100">User can buy TomaaS NFT</p>
          </div>
          <div className="flex flex-col p-4 bg-white/20 rounded-2xl">
            <h3 className="mt-4 text-2xl font-bold text-gray-100">Stake NFT</h3>
            <Image className="mx-auto my-8" src={stakeNFT} alt="stake NFT" width="280" height="280" />
            <p className="mt-2 text-semibold text-gray-100">User can stake it to staking pool and provide liquidity</p>
          </div>
          <div className="flex flex-col p-4 bg-white/20 rounded-2xl">
            <h3 className="mt-4 text-2xl font-bold text-gray-100">Get Reward</h3>
            <Image className="mx-auto my-10" src={getReward} alt="get Rewards" width="250" height="268" />
            <p className="mt-2 text-semibold text-gray-100">User can claim rewards</p>
          </div>
        </div>
      </SectionTitle>
      <SectionTitle
        title="Make rewards from real world services">
          <p className='text-gray-100 mb-8'>Be owner of Mobility Device or Subject of Liquidity for TomaaS Ecosystem</p>
          <div className="flex flex-col p-4 bg-white/20 rounded-2xl">
            <Image className="mx-auto my-4" src={howTomaasMakesRewards} alt="how it makes rewards" width="1405" height="661" />
          </div>
      </SectionTitle>
      <SectionTitle
        title="Parnterships">
          <div className='flex items-center justify-center text-center'>
            <Image
              src="/partner_flowerroad_logo.png"
              width="324"
              height="98"
              className={"object-cover"}
              alt="Parnter Illustration"
              loading="eager"
            /> 
          </div>
      </SectionTitle>
      <Footer />
    </>
  );
}

export default Home
