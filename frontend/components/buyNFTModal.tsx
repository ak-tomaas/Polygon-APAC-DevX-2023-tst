
import { ethers } from 'ethers';
import { useEffect, useState } from 'react'
import 'dotenv/config'

import styled from '@emotion/styled'

import { ERC20MockJSON, ContractAddressJSON, TLNJSON, LendingJSON, MarketplaceJSON } from '../contracts/loadContracts';

//Modal Window Backgrounds
export const SearchModalBox = styled.div`
	position: fixed;
	top: 0;
    left: 0;
    width: 100%;
    height: 100%;
	background-color: rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: center;
    align-items: center;
`
//Implement the modal style you want to create here
export const SearchModalContent = styled.div`
    padding: 1.5rem 3rem;
    width: 28.125rem;
    border-radius: 0.313rem;
    display: flex;
    flex-direction: column;
    background-color: #ffffff;
      > div:nth-of-type(1) {
        background-color: #c8c7c7;
        border-radius: 0.313rem;
      }
      > input {
        display: flex;
        align-items: center;
        margin-top: 0.625rem;
        border: 0.063rem solid gray;
        padding: 0.8rem 1rem;
        font-size: 1rem;
      }
      > div {
        display: flex;
        justify-content: space-evenly;
        margin-top: 1.25rem;
        > button {
          border: none;
          width: 6.875rem;
          padding: 0.8rem 1.8rem;
          font-size: 0.9rem;
        }
        > :nth-of-type(2) {
          background-color: #e15050;
        }
      }`

type ProductInfo = {
  id: number,
  name: string,
  href: string,
  imageSrc: string,
  imageAlt: string,
  amount: number,
}

const BuyNFTModal = (props:any) => {

  const {clickModal, clickNotification} = props;
  const items = props.items;
  const type = props.type;

  const [selected, setSelected] = useState(0);
  const [value, setValue] = useState(0);

  const [products, setProducts] = useState<ProductInfo[]>([]);

  const [dataFetched, updateFetched] = useState(false);
  const [tlnContract, setTlnContract] = useState<ethers.Contract | null>(null);
  // const [trnContract, setTrnContract] = useState<ethers.Contract | null>(null);
  const [marketplaceContract, setMarketplaceContract] = useState<ethers.Contract | null>(null);
  const [usdcContract, setUsdcContract] = useState<ethers.Contract | null>(null);

  const [decimals, setDecimals] = useState(0);
  const [walletAddr, setWalletAddr] = useState("0x");
  const [amountOfAprrove, setAmountOfAprrove] = useState<ethers.BigNumber>(ethers.BigNumber.from(0));
  const [totalPrice, setTotalPrice] = useState<ethers.BigNumber>(ethers.BigNumber.from(0));
  const [needToApprove, setNeedToApprove] = useState(true);

  const checkApproval = async () => {
    if (usdcContract) {
      let prices = [];
      let listing = items[0].listing;
      let count = value;
      let total = ethers.BigNumber.from(0);

      if (type === "buy") {
        if (count > listing.length) {
          count = listing.length;
          setValue(count);
        }

        for (let i = 0; i < count; i++) {
          prices.push(ethers.utils.parseUnits(String(listing[i].price), decimals));
        }
        //add all prices
        for (let i = 0; i < prices.length; i++) {
          total = total.add(prices[i]);
        }
      }
      else {
        let price = ethers.utils.parseUnits(String(items[0].listing[0].price), decimals);
        total = ethers.BigNumber.from(0);
        for (let i = 0; i < count; i++) {
          total = total.add(price);
        }
      }

      setTotalPrice(total);
      
      try {
        let address;
        if (type === "buy") {
          address = ContractAddressJSON.TomaasMarketplace;
        } else {
          address = ContractAddressJSON.TomaasLPN;
        }
        usdcContract.allowance(walletAddr, address).then((remaining: any) => {
          // console.log("remaining : ", remaining.toString(), "totalPrice : ", total.toString());
          setAmountOfAprrove(remaining);
          if (remaining.toString() === "0") {
            setNeedToApprove(true);
          }
          else if (remaining.lt(total)) {
            setNeedToApprove(true);
          }
          else {
            setNeedToApprove(false);
          }
        });
      }
      catch (err) {
        console.log("usdcContract.allowance error : ", err);
        alert("usdcContract.allowance error : " + err);
      }
    }
  }

  const decrement = () => {
    setValue(value - 1);
    // checkApproval(value);
  }

  const increment = () => {
    setValue(value + 1);
    // checkApproval(value);
  }

  const handleChange = (event:any) => {
    let value = Number(event.target.value);
    setValue(value);
    // checkApproval(value);
  }

  async function approve() {
    try {
      let address;
      if (type === "buy") {
        address = ContractAddressJSON.TomaasMarketplace;
      } else {
        address = ContractAddressJSON.TomaasLPN;
      }

      if (usdcContract) {
        console.log("usdcContract.approve : ", totalPrice.toString());
        clickNotification(true, {title: "Approving", description: "Please wait for a while."});
        clickModal();
        const tx = await usdcContract.approve(address, totalPrice);

        tx.wait().then((receipt: any) => {
          console.log("usdcContract.wait receipt : ", receipt);
        }
        ).catch((err: any) => {
          console.log("usdcContract.wait error : ", err);
          // alert("usdcContract.approve error : " + err);
        }).finally(() => {
          clickNotification(false);
          checkApproval();
        });
      }
    }
    catch (err) {
      console.log("usdcContract.approve error : ", err);
      clickNotification(false);
      // alert("usdcContract.approve error : " + err);
      return;
    }
  }

  async function buyTRN(count: number) {
    console.log("buyTRN : ", count, " usdcDecimals : ", decimals.toString());

    let tokenIds = [];
    let prices = [];
    let trnAddr = items[0].nftAddr;
    let listing = items[0].listing;

    for (let i=0; i<count; i++) {
      tokenIds.push(listing[i].tokenId);
      console.log("i", i, "price : ", listing[i].price);
      prices.push(ethers.utils.parseUnits(String(listing[i].price), decimals));
      console.log("i", i, "price : ", prices[i].toString());
    }

    console.log("tokenIds : ", tokenIds);
    console.log("prices : ", tokenIds);

    //add all prices
    let total = ethers.BigNumber.from(0);
    for (let i=0; i<prices.length; i++) {
      total = total.add(prices[i]);
    }

    try {
      console.log("buyMultipleNFT : trnAddr: ", trnAddr, " prices:",  prices, "tokenIds:", tokenIds);
      clickNotification(true, {title: "Buying", description: "Please wait for a while."});
      const tx = await marketplaceContract?.buyMultipleNFT(trnAddr, prices, tokenIds);
      clickModal();
      tx.wait().then((receipt: any) => {
        console.log("buyMultipleNFT.wait receipt : ", receipt);
      }).catch((err: any) => {
        console.log("buyMultipleNFT.wait error : ", err);
      }).finally(() => {
        checkApproval();
        clickNotification(false);
      });
    }
    catch (err) {
      console.log("marketplaceContract.buyMultipleNFT error : ", err);
      clickNotification(false);
      return;
    }
  }

  async function mintTLN(count: number) {
    console.log("mintTLN : ", count, " usdcDecimals : ", decimals.toString());

    let price;
    let total;
    let tokenUri;
    tokenUri = items[0].listing[0].tokenUri;

    try {
      clickNotification(true, {title: "Minting", description: "Please wait for a while."});
      let tx = await tlnContract?.safeMintMultiple(walletAddr, tokenUri, count);
      clickModal();
      tx.wait().then((receipt: any) => {
        console.log("MintMultiple.wait receipt : ", receipt);
      }).catch((err: any) => {
        console.log("MintMultiple.wait error : ", err);
      }).finally(() => {
        checkApproval();
        clickNotification(false);
      });
    }
    catch (err) {
      console.log("MintMultiple error : ", err);
      clickNotification(false);
      // alert("tlnContract.mintMultiple error : " + err);
      return;
    }
  }

  const buyAndMint = async () => {
    console.log("buyAndMint");
    if (selected === 0) {
      alert("Please select a product.");
      return;
    }
    console.log("selected: " + selected);
    if (value === 0) {
      alert("Please enter the number of products.");
      return;
    }
    console.log("value: " + value);
    //show loading
    //check buy or mint
    if (type === "buy") {
      await buyTRN(value);
    }
    else {
      await mintTLN(value);
    }
  }

  const loadingProducts = async () => {
    if (items.length > 0) {
      let product = {
        id: 0,
        name: "",
        href: "",
        imageSrc: "",
        imageAlt: "",
        amount: 0,
      };

      let products: ProductInfo[] = [];

      product.id = items[0].nftAddr;
      product.name = items[0].listing[0].name;
      product.href = "/";
      product.imageSrc = items[0].listing[0].image;
      product.imageAlt = items[0].listing[0].description;
      product.amount = items[0].listing.length;
      products.push(product);

      setSelected(product.id);
      setProducts(products);
    }
  }

  const loadingContract = async () => {
    updateFetched(true);
    console.log("loadingContract");

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
    }

    console.log("addr : ", addr);

    let usdcContract = new ethers.Contract(ContractAddressJSON.USDC, ERC20MockJSON.abi, signer);
    setUsdcContract(usdcContract);

    let usdcDecimals = await usdcContract.decimals();
    console.log("usdcDecimals : ", usdcDecimals.toString());
    setDecimals(usdcDecimals);

    // let trnContract = new ethers.Contract(
    //                                     ContractAddressJSON.TomaasRWN,
    //                                     TRNJSON.abi,
    //                                     signer);
    // setTrnContract(trnContract);

    let tlnContract = new ethers.Contract(
                                        ContractAddressJSON.TomaasLPN,
                                        TLNJSON.abi,
                                        signer);

    setTlnContract(tlnContract);

    let marketplaceContract = new ethers.Contract(
                                            ContractAddressJSON.TomaasMarketplace, 
                                            MarketplaceJSON.abi, 
                                            signer);
    setMarketplaceContract(marketplaceContract);
  };

  useEffect(() => {
    console.log("useEffect by value ");
    checkApproval();
  }, [value]);

  useEffect(() => {
    console.log("useEffect");
    if (window.ethereum === undefined) {
      console.log("there isn't crypto wallet");
      return;
    }

    let val = window.ethereum.isConnected();
    if (val) {
      console.log("ethereum is connected");
    }
    
    if (!dataFetched) {
      loadingContract();
    }

    loadingProducts();

  }, []);

  return (
    <>
    <SearchModalBox onClick={clickModal}>
      <SearchModalContent onClick={(e) => e.stopPropagation()}>

        <form className="mx-auto max-w-2xl px-4">
          <ul role="list" className="divide-y divide-gray-200">
            {products.map((product) => (
              <li key={product.id} className="flex items-center py-6">
                <input
                  id={String(product.id)}
                  name="notification-method"
                  type="radio"
                  defaultChecked={selected === product.id}
                  onClick={() => setSelected(product.id)}
                  className="h-4 w-4 mr-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                <div className='flex-auto'>
                  <img
                    src={product.imageSrc}
                    alt={product.imageAlt}
                    className="h-16 w-16 flex-none rounded-md border border-gray-200"
                  />
                  <p className="text-gray-500 text-sm">{product.amount}pcs</p>
                </div>
                <div className="ml-4 flex-auto">
                  <h3 className="font-medium text-gray-900">
                    {product.name}
                  </h3>
                  {selected === product.id ?
                    (
                      <div className="custom-number-input h-8 w-32">
                        <div className="flex flex-row h-full w-full rounded-lg relative bg-transparent mt-1">
                          <div onClick={decrement}
                            className="bg-gray-300 text-gray-600 
                                    hover:text-gray-700 hover:bg-gray-400 
                                      h-full w-20 rounded-l cursor-pointer outline-none">
                            <span className="m-auto text-2xl font-thin">−</span>
                          </div>
                          <input type="number" className="outline-none focus:outline-none 
                                    text-center w-full bg-gray-300 font-semibold text-md 
                                    hover:text-black focus:text-black 
                                    md:text-basecursor-default flex items-center text-gray-700"
                            name="custom-input-number" value={value} onChange={handleChange} ></input>
                          <div onClick={increment}
                            className="bg-gray-300 text-gray-600 
                                  hover:text-gray-700 hover:bg-gray-400 
                                  h-full w-20 rounded-r cursor-pointer">
                            <span className="m-auto text-2xl font-thin">+</span>
                          </div>
                        </div>
                      </div> 
                    ) : null
                  }
                </div>
              </li>
            ))}
          </ul>

          {
            needToApprove ? (
              <div onClick={approve}
                className="w-full rounded-md border border-transparent px-4 py-2
                bg-indigo-600 text-sm font-medium text-white shadow-sm
                hover:bg-indigo-700 focus:outline-none focus:ring-2
                focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-50">
                Approve
              </div>
            ) : (
              <div onClick={buyAndMint}
                className="w-full rounded-md border border-transparent px-4 py-2 
                bg-indigo-600 text-sm font-medium text-white shadow-sm 
                hover:bg-indigo-700 focus:outline-none focus:ring-2 
                focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-50">
                {type === "buy" ? "Buy" : "Mint"}
            </div>
            )
          }

          <p className="mt-6 text-center">
            <a href="#" onClick={clickModal} className="text-sm font-medium 
                            text-indigo-600 hover:text-indigo-500">
             Close 
            </a>
          </p>
        </form>

      </SearchModalContent>
    </SearchModalBox>
    </>
  )
}

export default BuyNFTModal;
