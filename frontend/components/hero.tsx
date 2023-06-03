import Image from "next/image";
import Container from "./container";
import heroImg from "../public/logo.png";
import { useState, useEffect } from "react";

const Hero = (props: any) => {
  const [tvl, updateTVL] = useState(0);
  const [tnft, updateTNFT] = useState(0);
  const [tss, updateTSS] = useState(0);
  const [tbv, updateTBV] = useState(0);
  const [trs, updateTRS] = useState(0);
  const [ttln, updateTTLN] = useState(0);

  console.log(props.totalInfo);
  let totalInfo = props.totalInfo;
  let totalSettlementSum = totalInfo.totalSettlementSum;
  let bookvalue = totalInfo.lastDeatilReport.bookValue;
  let amountOfVehicle = totalInfo.lastDeatilReport.amountOfVehicle;
  let exchangeRate = totalInfo.lastDeatilReport.exchangeRate;

  //Amount of vehicle(TRN) * price of TRN / price of TLN
  let amountOfTLNS = amountOfVehicle * 300 / 100

  useEffect(() => {
    let tss = totalSettlementSum / exchangeRate;
    let tbv = bookvalue * amountOfVehicle;
    let usdTvl = tss + tbv;
    updateTNFT(amountOfVehicle);

    let totalTLNRewards = amountOfTLNS * 100 * 0.18;
    updateTVL(usdTvl);
    updateTSS(tss);
    updateTBV(tbv);
    updateTTLN(amountOfTLNS);
    updateTRS(totalTLNRewards);
  }, [props.totalInfo]);

  return (
    <>
      <Container className="flex flex-wrap">
        <div className="relative flex items-center justify-center w-full lg:w-1/2">
          <div className="max-w-2xl mb-8 ml-24">
            <h1 className="text-4xl font-bold leading-snug tracking-tight text-gray-100 lg:text-4xl lg:leading-tight xl:text-6xl xl:leading-tight dark:text-white">
              Trustless On-demand shared Mobility As A Service 
            </h1>
            <p className="py-5 text-xl leading-normal text-gray-200 lg:text-xl xl:text-2xl dark:text-gray-300">
              Create sustainable and transparent shared mobility ecosystem to user-centric services for all participants. 
            </p>
          </div>
        </div>
        <div className="relative flex items-center justify-center w-full lg:w-1/2">
          <div className="absolute -left-24">
            <Image
              src={heroImg}
              width="616"
              height="617"
              className={"object-cover opacity-30"}
              alt="Hero Illustration"
              loading="eager"
              placeholder="blur"
            />
          </div>
        </div>
      </Container>
      <Container>
        <div className="flex flex-col justify-center bg-white/70 dark:bg-violet-700 w-full">
          <div className="flex flex-wrap justify-center gap-5 md:justify-around">
            <div className="text-gray-800 dark:text-gray-200">
              <TotalValueLocked tvl={tvl}/>
            </div>
            <div className="text-gray-800 dark:text-gray-200">
              <TotalTRN tnft={tnft}/>
            </div>
            <div className="text-gray-800 dark:text-gray-200">
              <TotalRWNRewards tss={tss}/>
            </div>
            <div className="text-gray-800 dark:text-gray-200">
              <TotalTLN ttln={ttln}/>
            </div>
            <div className="text-gray-800 dark:text-gray-200">
              <TotalTLNRewards trs={trs}/>
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}

function TotalValueLocked({tvl}: any) {
  const formattedData = Number(tvl).toLocaleString(); // format the number

  return (
   <div>
      <div className="flex flex-col items-center justify-center">
        <p>Total Value Locked</p>
        <p>${formattedData}</p>
      </div>
   </div> 
  );
}

function TotalTRN({tnft}: any) {
  const formattedData = Number(tnft).toLocaleString(); // format the number
  return (
    <div>
      <div className="flex flex-col items-center justify-center">
        <p>Total TRNs</p>
        <p>{formattedData}</p>
      </div>
   </div>
  );
}

/**
 * 
 * @param param0 total TRN rewards
 * @returns 
 */
function TotalRWNRewards({tss}: any) {
  const formattedData = Number(tss).toLocaleString(); // format the number
  return (
    <div>
      <div className="flex flex-col items-center justify-center">
        <p>TRN Total Annual Rewards</p>
        <p>${formattedData}</p>
      </div>
   </div>
  );
}

function TotalTLN({ttln}: any) {
  const formattedData = Number(ttln).toLocaleString(); // format the number
  return (
    <div>
      <div className="flex flex-col items-center justify-center">
        <p>Total TLNs</p>
        <p>{formattedData}</p>
      </div>
   </div>
  );
}

/**
 * 
 * @param param0 total TLN rewards
 * @returns 
 */
function TotalTLNRewards({trs}: any) {
  const formattedData = Number(trs).toLocaleString(); // format the number
  return (
    <div>
      <div className="flex flex-col items-center justify-center">
        <p>TLN Total Annual Rewards</p>
        <p>${formattedData}</p>
      </div>
   </div>
  );
}

export default Hero;