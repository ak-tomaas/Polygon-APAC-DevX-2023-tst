// SPDX-License-Identifier: BSL-1.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
 * @title Tomaas Liquidity Provider NFT
 * @author tomaas labs
 * @notice 
 * @custom:security-contact security@tomaas.ai
 */
contract TomaasLPN is
    ERC721,
    ERC721Enumerable,
    ERC721URIStorage,
    Pausable,
    Ownable,
    ReentrancyGuard
{
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    IERC20 private acceptedToken;

    // uint256[] public tokenIds;

    mapping(address => bool) whitelist;
    mapping(uint256 => uint256) tokenBalOfNFT;
    uint256 private price;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address _acceptedToken,
        uint256 _price
    ) ERC721("Tomaas Liquidity Provider NFT", "TLN") {
        acceptedToken = IERC20(_acceptedToken);
        price = _price;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    // function safeMint(address to, string memory uri) public onlyOwner {
    //     uint256 tokenId = _tokenIdCounter.current();
    //     _tokenIdCounter.increment();
    //     _safeMint(to, tokenId);
    //     _setTokenURI(tokenId, uri);
    // }

    function priceOf() public view returns (uint256) {
        return price;
    }

    /**
     * safe multiple mint 
     * @param to destination address
     * @param uri token uri
     * @param num number of tokens to mint 
     */ 
    function safeMintMultiple(address to, string memory uri, uint64 num) public {
        require(
            !(acceptedToken.balanceOf(msg.sender) < price * num),
            "Not Enough Balance"
        );
        require(
            acceptedToken.transferFrom(msg.sender, address(this), price * num),
            "TLN : transferFailed"
        );

        uint256 tokenId;

        for (uint64 i = 0; i < num; i++) {
            tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();
            tokenBalOfNFT[tokenId] = price;
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, uri);
        }
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    )
        internal
        override(ERC721, ERC721Enumerable)
        whenNotPaused
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // The following functions are overrides required by Solidity.

    function _burn(
        uint256 tokenId
    ) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    /**
     * @dev See {IERC721Metadata-tokenURI}. 
     * @param tokenId token id
     */
    function tokenURI(
        uint256 tokenId
    )
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev add address to whitelist 
     * @param _address address to add to whitelist
     */
    function addToWL(address _address) public onlyOwner {
        whitelist[_address] = true;
    }

    /**
     * @dev remove address from whitelist
     * @param _address address to remove from whitelist
     */
    function rmFromWL(address _address) public onlyOwner {
        whitelist[_address] = false;
    }

    /**
     * @dev check if address is in whitelist    
     * @param _address address to check
     */
    function isWL(address _address) public view returns (bool) {
        return whitelist[_address];
    }

    /**
     * @dev WITHDRAW can only be done by whitelisted protocols. 
     * @param _tokenId token id
     */
    function withdraw(uint256 _tokenId) nonReentrant public {
        require(ownerOf(_tokenId) == msg.sender, "You are not owner");
        require(whitelist[msg.sender], "You do not have permission");
        require(
            acceptedToken.balanceOf(address(this)) >= price,
            "Contract Does not have enough token"
        );
        require(
            acceptedToken.transfer(msg.sender, tokenBalOfNFT[_tokenId]),
            "Token Transfer Failed"
        );
        require(tokenBalOfNFT[_tokenId] != 0, "Token has 0 token.");
        tokenBalOfNFT[_tokenId] = 0;
    }

    function depositToken(uint256 _tokenId) public {
        require(ownerOf(_tokenId) == msg.sender, "You are not owner");
        require(
            acceptedToken.transferFrom(msg.sender, address(this), price),
            "Token Transfer Failed"
        );
        tokenBalOfNFT[_tokenId] = price;
    }

    /**
     * @dev WITHDRAW can only be done by whitelisted protocols. 
     * @param _tokenIds array of token ids
     */
    function withdrawMultiple(uint256[] memory _tokenIds) public {
        require(whitelist[msg.sender], "Not whitelisted");
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            require(
                ownerOf(_tokenIds[i]) == msg.sender,
                "You entered a tokenId that is not yours"
            );
            require(tokenBalOfNFT[_tokenIds[i]] > 0, "token has no balance");
        }
        uint256 withdrawVal = 0;
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            withdrawVal += tokenBalOfNFT[_tokenIds[i]];
        }
        require(
            acceptedToken.balanceOf(address(this)) >= withdrawVal,
            "Contract Does not have enough token"
        );
        require(
            acceptedToken.transfer(msg.sender, withdrawVal),
            "Token Transfer Failed"
        );
        for (uint256 i = 0; i < _tokenIds.length; i++) {
            tokenBalOfNFT[_tokenIds[i]] = 0;
        }
    }

    function getTokenBalOfNFT(uint256 _tokenId) public view returns (uint256) {
        return tokenBalOfNFT[_tokenId];
    }
}
