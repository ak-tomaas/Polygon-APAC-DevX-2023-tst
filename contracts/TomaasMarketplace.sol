// SPDX-License-Identifier: BSL-1.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./TomaasRWN.sol";
import "./TomaasLending.sol";

contract TomaasMarketplace is ReentrancyGuard, Ownable, Pausable
{

    // Add the library methods
    using EnumerableSet for EnumerableSet.UintSet;

    uint8 public _salesFee;
    TomaasLending private _tomaasLending;

    struct SaleInfo {
        uint256 tokenId; // tokenId of NFT
        address seller; // address of seller
        uint256 price; // price of token
        bool isAvailable; // is available for sale
    }

    //nftaddress => arrary of tokenIds list for sale in collection
    mapping(address => uint256[]) private _listTokenIds;

    //nftaddress => tokenId => SaleInfo
    mapping(address => mapping(uint256 => SaleInfo)) private _listForSale;

    event NFTListedForSale(address indexed collection, uint256 tokenId, uint256 price);
    event NFTBought(address indexed collection, uint256 tokenId, uint256 price);

    event NFTsListedForSale(address indexed collection, uint256 price, uint256[] tokenIds);
    event NFTsBought(address indexed collection, uint256[] prices, uint256[] tokenIds);

    constructor(address lendingProtocolAddress) {
        _salesFee = 100; //1%
        _tomaasLending = TomaasLending(lendingProtocolAddress);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @param salesFee 1% = 100, 100% = 10000
     */
    function setProtocolFee(uint8 salesFee) external onlyOwner {
        _salesFee = salesFee;
    } 

    /**
     * @return protocolFee protocol fee
     */
    function getSalesFee() public view returns (uint256) {
        return _salesFee;
    }

    /**
     * @dev add or update list for sale info
     * @param nftAddress address of collection
     * @param tokenId tokenId of NFT
     * @param seller  address of seller
     * @param price  price of NFT
     */
    function _addListForSale(address nftAddress, uint256 tokenId, address seller, uint256 price) internal {
        if (_listForSale[nftAddress][tokenId].isAvailable == false) {
            _listTokenIds[nftAddress].push(tokenId); 
        }
        _listForSale[nftAddress][tokenId] = SaleInfo(tokenId, seller, price, true);
    }

    function _removeListForSale(address nftAddress, uint256 tokenId) internal {
        uint256[] storage ids = _listTokenIds[nftAddress];
        uint256 index = ids.length;
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == tokenId) {
                index = i;
                break;
            }
        }
        require(index < ids.length, "TM: tokenId is not found");
        ids[index] = ids[ids.length - 1];
        ids.pop();
        delete _listForSale[nftAddress][tokenId];
    }

    /**
     * @param nftAddress address of TomaasRWN
     * @return saleInfos all NFTs for sale in collection
     */
    function _getListForSale(address nftAddress) internal view returns (SaleInfo[] memory) {
        uint256[] storage ids = _listTokenIds[nftAddress];
        SaleInfo[] memory saleInfos = new SaleInfo[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            saleInfos[i] = _listForSale[nftAddress][ids[i]];
        }
        return saleInfos;
    }

    /**
     * The ERC20 token's address must be the same as the acceptedToken in the TomaasRWN contract. 
     * @dev Frontend should obtain the applied token address from the TomaasRWN contract. 
     * @param nftAddress  address of NFT
     * @param tokenId tokenId of NFT 
     * @param price price of NFT  
     */
   function listingForSale(address nftAddress, uint256 tokenId, uint256 price) external nonReentrant {
        require(price > 0, "TM: nftAddress is the zero address or price is zero");

        TomaasLending.CollectionInfo memory collectionInfo = _tomaasLending.getCollectionInfo(nftAddress);
        TomaasRWN tomaasRWN = collectionInfo.tomaasRWN;
        require(tomaasRWN.ownerOf(tokenId) == msg.sender, "TM: you are not the owner of this NFT");

        require(tomaasRWN.unClaimedEarnings(tokenId) == 0, "TM: you have rest of yield");

        _addListForSale(nftAddress, tokenId, msg.sender, price);
        emit NFTListedForSale(nftAddress, tokenId, price);
    }

    function listingMultipleForSale(address nftAddress, 
                            uint256 price,
                            uint256[] memory tokenIds) 
            external 
            nonReentrant 
    {
        require(price > 0, "TM: nftAddress is the zero address or price is zero");

        TomaasLending.CollectionInfo memory collectionInfo = _tomaasLending.getCollectionInfo(nftAddress);
        TomaasRWN tomaasRWN = collectionInfo.tomaasRWN;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            //check tokenid is valid
            require(tomaasRWN.ownerOf(tokenIds[i]) == msg.sender, "TM: you are not the owner of this NFT");
            require(tomaasRWN.unClaimedEarnings(tokenIds[i]) == 0, "TM: you have rest of yield");
            _addListForSale(nftAddress, tokenIds[i], msg.sender, price);
        }

        emit NFTsListedForSale(nftAddress, price, tokenIds); 
    }

    function isForSale(address nftAddress, uint256 tokenId) external view returns (bool) {
        require(_listForSale[nftAddress][tokenId].price != 0, "TM: there isnot this NFT for sale");

        TomaasRWN tomaasRWN = TomaasRWN(nftAddress);
        require(_listForSale[nftAddress][tokenId].seller == tomaasRWN.ownerOf(tokenId), "TM: seller is not the owner of this NFT");
        require(_listForSale[nftAddress][tokenId].isAvailable, "TM: NFT is not for sale");
        return true;
    }

    function getSaleInfo(address nftAddress, uint256 tokenId) external view returns (SaleInfo memory) {
        require(_listForSale[nftAddress][tokenId].price != 0, "TM: there isnot this NFT for sale");
        require(_listForSale[nftAddress][tokenId].isAvailable, "TM: NFT is not for sale");

        return _listForSale[nftAddress][tokenId];
    }

    /**
     * 
     * @param nftAddress  address of TomaasRWN
     * @param tokenId tokenId of TomaasRWN 
     * @param price price of TomaasRWN 
     */
    function buyNFT(address nftAddress, uint256 tokenId, uint256 price) external nonReentrant {
        require(price > 0, "TM: price is zero");

        TomaasLending.CollectionInfo memory collectionInfo = _tomaasLending.getCollectionInfo(nftAddress);
        TomaasRWN tomaasRWN = TomaasRWN(nftAddress);
        address tokenOwner = tomaasRWN.ownerOf(tokenId);

        require(_listForSale[nftAddress][tokenId].seller == tokenOwner, "TM: seller is not the owner of this NFT");
        require(_listForSale[nftAddress][tokenId].isAvailable, "TM: NFT is not for sale");
        require(_listForSale[nftAddress][tokenId].price == price, "TM: price is not correct");

        IERC20 token = collectionInfo.acceptedToken; //it's from TomaasRWN's acceptedToken
        require(token.balanceOf(msg.sender) >= price, "TM: not enough token balance");

        uint256 fee = price * (_salesFee / 10000);
        uint256 profit = price - fee;
        require(token.transferFrom(msg.sender, _listForSale[nftAddress][tokenId].seller, profit), "TM: failed to transfer token rent to contract");
        require(token.transfer(owner(), fee), "TM: failed to transfer token rent to owner");

        _listForSale[nftAddress][tokenId].seller = address(0);
        _listForSale[nftAddress][tokenId].price = 0;
        _listForSale[nftAddress][tokenId].isAvailable = false;

        tomaasRWN.safeTransferFrom(tokenOwner, msg.sender, tokenId);

        _removeListForSale(nftAddress, tokenId);

        emit NFTBought(nftAddress, tokenId, price);
    }

    function buyMultipleNFT(address nftAddress, 
                            uint256[] memory prices, 
                            uint256[] memory tokenIds) 
        external 
        nonReentrant 
    {
        require(prices.length == tokenIds.length, "TM: prices and tokenIds length is not equal");
        
        uint256 sumOfPrice = 0;
        for (uint256 i = 0; i < prices.length; i++) {
            require(prices[i] > 0, "TM: price is zero");
            sumOfPrice += prices[i];
        }

        TomaasLending.CollectionInfo memory collectionInfo = _tomaasLending.getCollectionInfo(nftAddress);
        TomaasRWN tomaasRWN = TomaasRWN(nftAddress);

        IERC20 token = collectionInfo.acceptedToken; //it's from TomaasRWN's acceptedToken
        require(token.balanceOf(msg.sender) >= sumOfPrice, "TM: not enough token balance");

        for (uint256 i = 0; i < tokenIds.length; i++) {

            address tokenOwner = tomaasRWN.ownerOf(tokenIds[i]);

            require(_listForSale[nftAddress][tokenIds[i]].seller == tokenOwner, "TM: seller is not the owner of this NFT");
            require(_listForSale[nftAddress][tokenIds[i]].isAvailable, "TM: NFT is not for sale");
            require(_listForSale[nftAddress][tokenIds[i]].price == prices[i], "TM: price is not correct");
            
            uint256 fee = prices[i] * (_salesFee / 10000);
            uint256 profit = prices[i] - fee;
            require(token.transfer(owner(), fee), "TM: failed to transfer token rent to owner");
            require(token.transferFrom(msg.sender, _listForSale[nftAddress][tokenIds[i]].seller, profit), "TM: failed to transfer token rent to contract");

            _listForSale[nftAddress][tokenIds[i]].seller = address(0);
            _listForSale[nftAddress][tokenIds[i]].price = 0;
            _listForSale[nftAddress][tokenIds[i]].isAvailable = false;

            tomaasRWN.safeTransferFrom(tokenOwner, msg.sender, tokenIds[i]);

            _removeListForSale(nftAddress, tokenIds[i]);
        }

        emit NFTsBought(nftAddress, prices, tokenIds);
    }

    /**
     * 
     * @param nftAddress address of TomaasRWN
     * @return saleInfos all NFTs for sale in collection
     */
    function getListedNFTs(address nftAddress) public view returns (SaleInfo[] memory) {
        return _getListForSale(nftAddress);
    }
}
