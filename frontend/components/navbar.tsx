import Link from "next/link";
import Image from "next/image"
import { Disclosure } from "@headlessui/react";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router'

const ethers = require("ethers");

const Navbar = () => {
  const navigation = [
    "Buy",
    "Lend",
    "Stake",
    "Dashboard",
  ];

  const [connected, toggleConnect] = useState(false);
  const router = useRouter();
  const [currAddress, updateAddress] = useState('0x');

  async function getAddress() {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      
      try {
        const addr = await signer.getAddress();
        updateAddress(addr);
        toggleConnect(true);
      }
      catch (err) {
        console.log(err);
      }
  }

  function updateButton() {
      const ethereumButton = document.querySelector('.enableEthereumButton');
      ethereumButton? ethereumButton.textContent = "Connected": console.log('no button');
  }

  async function connectWebsite() {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    console.log(chainId);
    // Sepolia Network ID
    //const sepoliaChainId = '0xA869';
    const sepoliaChainId = '0xaa36a7';
    // Goerli Network ID
    const goerliChainId = '0x5';

    if (chainId !== sepoliaChainId) {
      //alert('Incorrect network! Switch your metamask network to sepolia');
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: sepoliaChainId }],
      })
    }

    await window.ethereum.request({ method: 'eth_requestAccounts' })
      .then(() => {
        // updateButton();
        console.log("here");
        getAddress();
        window.location.replace(router.pathname)
      });
  }

  useEffect(() => {
      if (window.ethereum === undefined) {
          console.log("there isn't crypto wallet");
          return;
      }

      let val = window.ethereum.isConnected();
      if (val) {
          console.log("ethereum is connected");
          getAddress();
          // updateButton();
      }
      else {
          console.log("ethereum is not connected");
          toggleConnect(false);
      }
      console.log("connected: ", connected);

      window.ethereum.on('accountsChanged', function (accounts:any) {
          console.log("accounts", accounts);
          window.location.replace(router.pathname)
      })
  }, []);

  return (
    <div className="w-full">
      <nav className="container relative flex flex-wrap items-center justify-between p-8 mx-auto lg:justify-between">
        {/* Logo  */}
        <Disclosure>
          {({ open }) => (
            <>
              <div className="flex flex-wrap items-center justify-between w-full lg:w-auto">
                <Link href="/">
                  <span className="flex items-center space-x-2 text-2xl font-medium 
                                    text-gray-200 dark:text-gray-100">
                    <span>
                      <Image
                        src="/logo.png"
                        alt="N"
                        width="32"
                        height="22"
                        className="w-8"
                      />
                    </span>
                    <span>TomaaS</span>
                  </span>
                </Link>

                <Disclosure.Button
                  aria-label="Toggle Menu"
                  className="px-2 py-1 ml-auto text-gray-500 rounded-md lg:hidden hover:text-gray-900 focus:text-gray-900 focus:bg-violet-100 focus:outline-none dark:text-gray-300 dark:focus:bg-trueGray-700">
                  <svg
                    className="w-6 h-6 fill-current"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24">
                    {open && (
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M18.278 16.864a1 1 0 0 1-1.414 1.414l-4.829-4.828-4.828 4.828a1 1 0 0 1-1.414-1.414l4.828-4.829-4.828-4.828a1 1 0 0 1 1.414-1.414l4.829 4.828 4.828-4.828a1 1 0 1 1 1.414 1.414l-4.828 4.829 4.828 4.828z"
                      />
                    )}
                    {!open && (
                      <path
                        fillRule="evenodd"
                        d="M4 5h16a1 1 0 0 1 0 2H4a1 1 0 1 1 0-2zm0 6h16a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2zm0 6h16a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2z"
                      />
                    )}
                  </svg>
                </Disclosure.Button>

                <Disclosure.Panel className="flex flex-wrap w-full my-5 lg:hidden">
                  <>
                    {navigation.map((item, index) => (
                      <Link key={index} href="/" className="w-full px-4 py-2 -ml-4 text-gray-200 rounded-md dark:text-gray-300 hover:text-gray-900 focus:text-gray-900 focus:bg-violet-100 dark:focus:bg-gray-800 focus:outline-none">
                          {item}
                      </Link>
                    ))}
                    <Link href="/" className="w-full px-6 py-2 mt-3 text-center border-2 border-black text-white bg-black hover:bg-white hover:text-black hover:border-2 hover:border-black rounded-full lg:ml-5">         
                       connect wallet 
                    </Link>
                  </>
                </Disclosure.Panel>
              </div>
            </>
          )}
        </Disclosure>

        {/* menu  */}
        <div className="hidden text-center lg:flex lg:items-center">
          <ul className="items-center justify-end flex-1 pt-6 list-none lg:pt-0 lg:flex">
            {navigation.map((menu, index) => (
              <li className="mr-3 nav__item" key={index}>
                <Link href={menu} className="inline-block px-4 py-2 text-lg font-normal text-gray-200 no-underline rounded-md dark:text-gray-200 hover:text-gray-900 focus:text-gray-900 focus:bg-violet-100 focus:outline-none dark:focus:bg-gray-800">
                    {menu}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden mr-3 space-x-4 lg:flex nav__item">
          {
            connected ? (
              <button className="enableEthereumButton px-6 py-2 rounded-full md:ml-5
                border-2 border-gray-200 text-gray-500 bg-gray-200">
                Connected
              </button>
            ): (
              <button className="enableEthereumButton px-6 py-2 rounded-full md:ml-5
                border-2 border-white text-gray-800 bg-white
              hover:text-gray-100 hover:bg-gray-800 hover:border-2 hover:border-white "
                onClick={connectWebsite}>
                {connected ? "Connected" : "Connect"}
              </button>
            )
          } 
        </div>
      </nav>
    </div>
  );
}

export default Navbar;
