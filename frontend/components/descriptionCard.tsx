
import { useEffect, useState } from 'react';
import BuyNFTModal from "./buyNFTModal";
import Notification from './notification';

const DescriptionCard = (props: any) => {

  const [showNotification, setShowNotification] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [nftInfo, setNftInfo] = useState(props.nftInfo);
  const [items, setItems] = useState(props.items);
  const [notiTitile, setNotiTitle] = useState("");
  const [notiDescription, setNotiDescription] = useState("");

  const clickModal = () => setShowModal(!showModal)
  const clickNotification = (show:boolean, info:any) => {
    console.log("clickNotification ", show, info);
    if (info) {
      setNotiTitle(info.title);
      setNotiDescription(info.description);
    }
    setShowNotification(show)
  }

  useEffect(() => {
    let nftInfo = props.nftInfo;
    if (props.buttonLink === "buy") {
      nftInfo.remaining = props.items[0]?.listing?.length || 0;
    }
    else {
      nftInfo.remaining = "-"; //The amount of TRN to bring to staking * 3
    }
    console.log("type ",props.buttonLink, " nftInfo ", nftInfo);

    setNftInfo(nftInfo);
    setItems(props.items);
  }, [props.items])
      
  
  return (
    <>
    <div className="mt-4 mb-4 px-16 justify-center items-center">
      <dl className="text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-gray-600">Price</dt>
          <dd className="font-medium text-gray-900">{nftInfo.price} USDC</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-gray-600">Expire</dt>
          <dd className="font-medium text-gray-900">{nftInfo.expire}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-gray-600">APR</dt>
          <dd className="font-medium text-gray-900">{nftInfo.apr}%</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-gray-600"></dt>
          <dd className="text-xs text-gray-500">{nftInfo.aprDuration}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-gray-600">Remaining</dt>
          <dd className="font-medium text-gray-900">{nftInfo.remaining}</dd>
        </div>
      </dl>
    </div> 
    <button onClick={clickModal} className="py-2 rounded-full mx-10 my-5
        border-2 border-violet-700 text-white bg-violet-700 
        hover:text-violet-700 hover:bg-white hover:border-2 hover:border-violet-700">
      {props.buttonText}
    </button>
    {showModal && <BuyNFTModal clickModal={clickModal} 
                                items={items} 
                                type={props.buttonLink} 
                                clickNotification={clickNotification}/>}
    {showNotification && <Notification title={notiTitile} description={notiDescription}/> }
    </>
  );
}

export default DescriptionCard;
