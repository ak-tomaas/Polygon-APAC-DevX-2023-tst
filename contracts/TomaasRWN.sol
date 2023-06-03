// SPDX-License-Identifier: BSL-1.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

import "./IERC4907.sol";

// Uncomment this line to use console.log
import "hardhat/console.sol";

/**
 * contract provides a comprehensive implementation of an NFT rental protocol, 
 * with functions for managing user and expiry timestamps, 
 * collecting rental fees, and distributing earnings to NFT owners.
 * @title Tomaas Real World Asset NFT
 * @dev Implementation of the TomaasRWN
 * @custom:security-contact security@tomaas.ai
 */
contract TomaasRWN is
    Initializable, 
    ERC721Upgradeable, 
    ERC721URIStorageUpgradeable, 
    PausableUpgradeable, 
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    IERC4907
{
    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter private _tokenIdCounter;

    struct UserInfo {
        address user; // address of user role
        uint64 expires; // unix timestamp, user expires
    }

    //info of real world asset
    struct AssetInfo {
        uint256 svcStartDate; // unix timestamp, service start date of asset, start depreciation from this date
        uint64 usefulLife; // useful life of asset in years
        uint256 price; // price of asset
    }

    mapping(uint256 => UserInfo) internal _users;

    IERC20Upgradeable private _acceptedToken;

    uint256 _feeRate;

    AssetInfo _assetInfo;

    //token id => earnings
    mapping(uint256 => uint256) internal _unclaimedEarnings;
    uint256 internal _totalDistributedEarnings;

    //Renter address => token id list
    mapping(address => EnumerableSetUpgradeable.UintSet) private _rentedList; 

    event NewTRN(string name, address acceptedToken, uint256 svcStartDate, uint64 usefulLife, uint256 price);
    event UpdateUsers(address indexed user, uint64 expires, uint256[] tokenIds);

    event PayOutEarningsAllRented(address indexed renter, uint256 amount, string reportUri);
    event PayOutEarnings(address indexed renter, uint256 tokenId, uint256 amount, string reportUri);
    event PayOutEarningsMultiple(address indexed renter, uint256[] tokenIds, uint256 amount, string reportUri);

    event ClaimEarnings(address indexed owner, uint256 tokenId, uint256 amount);
    event ClaimEarningsAllRented(address indexed owner, uint256 count, uint256 amount);
    event ClaimEarningsMultiple(address indexed owner, uint256[] tokenIds, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(string memory _name, address acceptedToken, uint256 svcStartDate, uint64 usefulLife, uint256 price
    ) initializer public {
        _feeRate = 100; // 1% fee, 100% = 10000
        _acceptedToken = IERC20Upgradeable(acceptedToken);
        _assetInfo.svcStartDate = svcStartDate;
        _assetInfo.usefulLife = usefulLife;
        _assetInfo.price = price;

        __ERC721_init(_name, "TRN");
        __ERC721URIStorage_init();
        __Pausable_init();
        __Ownable_init();
        __ReentrancyGuard_init();

        emit NewTRN(_name, acceptedToken, svcStartDate, usefulLife, price);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function safeMint(address to, string memory uri) public onlyOwner {
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    /**
     * @dev mint multiple tokens 
     * @param to address of user
     * @param uri  token uri
     * @param number number of tokens to mint
     */
    function safeMintMultiple(address to, string memory uri, uint64 number) public onlyOwner {
        uint256 tokenId;

        for (uint256 i = 0; i < number; i++) {
            tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, uri);
        }
    }

    function safeMintMultipleAndSetUser(address to, 
            string memory uri, 
            uint64 number, 
            address user, 
            uint64 expires
    ) public onlyOwner {
        uint256 tokenId;
        uint256[] memory tokenIds = new uint256[](number);
        for (uint256 i = 0; i < number; i++) {
            tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, uri);
            _users[tokenId] = UserInfo(user, expires);

            EnumerableSetUpgradeable.add(_rentedList[user], tokenId);
            tokenIds[i] = tokenId;
        }
        emit UpdateUsers(user, expires, tokenIds);
    }

    // function approveMultiple(address to, uint256[] memory tokenIds) public {
    //     require(to != address(0), "TRN: approve to the zero address");
    //     require(tokenIds.length > 0, "TRN: approve tokenIds length is zero");

    //     address owner = ERC721Upgradeable.ownerOf(tokenIds[0]);
    //     require(
    //         _msgSender() == owner || isApprovedForAll(owner, _msgSender()),
    //         "TRN: approve caller is not token owner or approved for all"
    //     );

    //     for (uint256 i=0; i<tokenIds.length; i++) {
    //         uint256 tokenId = tokenIds[i];
    //         owner = ERC721Upgradeable.ownerOf(tokenId);
    //         require(to != owner, "TRN: approval to current owner");
    //         _approve(to, tokenId);
    //     }
    // }

    /**
     * The user remains the same even if the owner is changed.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721Upgradeable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);

        // keep user after transfer
        // if (from != to && _users[tokenId].user != address(0)) {
        //     delete _users[tokenId];
        //     emit UpdateUser(tokenId, address(0), 0);
        // }
    }

    function _burn(
        uint256 tokenId
    ) internal override(ERC721Upgradeable, ERC721URIStorageUpgradeable) {
        super._burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory) {
        require(_exists(tokenId), "RWN: tokenDoesNotExi");
        return super.tokenURI(tokenId);
    }

    /// @dev See {IERC165-supportsInterface}.
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (bool) {
        return
            interfaceId == type(IERC4907).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function _userOf(
        uint256 tokenId
    ) internal view returns (address) {
        if( uint256(_users[tokenId].expires) >=  block.timestamp ) {
            return  _users[tokenId].user;
        }
        else {
            return address(0);
        }
    }

    /// @notice set the user and expires of an NFT
    /// @dev The zero address indicates there is no user
    /// Throws if `tokenId` is not valid NFT
    /// @param user  The new user of the NFT
    /// @param expires  UNIX timestamp, The new user could use the NFT before expires
    function setUser(
        uint256 tokenId,
        address user,
        uint64 expires
    ) external override {
        require(_exists(tokenId), "RWN: tokenDoesNotExi");
        require(_isApprovedOrOwner(msg.sender, tokenId), "RWN: notOwnerOrAppr");

        address prevUser = _userOf(tokenId);
        if (prevUser != address(0)) {
            EnumerableSetUpgradeable.remove(_rentedList[prevUser], tokenId);
        }

        UserInfo storage info =  _users[tokenId];
        info.user = user;
        info.expires = expires;

        // console.log("setUser: tokenId: %s, user: %s, expires: %s", tokenId, user, expires);
        EnumerableSetUpgradeable.add(_rentedList[user], tokenId);
        emit UpdateUser(tokenId, user, expires);
    }

    function setUserMultiple(
        address user,
        uint64 expires,
        uint256[] calldata tokenIds
    ) external {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_exists(tokenIds[i]), "RWN: tokenDoesNotExi");
            require(_isApprovedOrOwner(msg.sender, tokenIds[i]), "RWN: notOwnerOrAppr");

            address prevUser = _userOf(tokenIds[i]);
            if (prevUser != address(0)) {
                EnumerableSetUpgradeable.remove(_rentedList[prevUser], tokenIds[i]);
            }

            UserInfo storage info =  _users[tokenIds[i]];
            info.user = user;
            info.expires = expires;
            EnumerableSetUpgradeable.add(_rentedList[user], tokenIds[i]);
        }
        emit UpdateUsers(user, expires, tokenIds);
    }

    /// @notice Get the user address of an NFT
    /// @dev The zero address indicates that there is no user or the user is expired
    /// @param tokenId The NFT to get the user address for
    /// @return The user address for this NFT
    function userOf(
        uint256 tokenId
    ) external view override returns (address) {
        require(_exists(tokenId), "RWN: tokenDoesNotExi");
        return _userOf(tokenId);
    }

    /// @notice Get the user expires of an NFT
    /// @dev The zero value indicates that there is no user
    /// @param tokenId The NFT to get the user expires for
    /// @return The user expires for this NFT
    function userExpires(
        uint256 tokenId
    ) external view override returns (uint256) {        
        require(_exists(tokenId), "RWN: tokenDoesNotExi");
        return _users[tokenId].expires;
    }

    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    function setFeeRate(uint256 rate) external onlyOwner {
        _feeRate = rate;
    }

    function getFeeRate() external view returns (uint256) {
        return _feeRate;
    }

    function _distributeEarning(address user, uint256 amount) internal {
        uint256 perAmount;
        uint256 tokenId;
        uint256 rentCount = EnumerableSetUpgradeable.length(_rentedList[user]);

        require(rentCount > 0, "Rent count must be greater than zero");

        perAmount = amount / rentCount;
        for (uint256 i = 0; i < rentCount; i++) {
            tokenId = EnumerableSetUpgradeable.at(_rentedList[user], i);
            _unclaimedEarnings[tokenId] += perAmount;
        }
    }

    function payOutEarningsAllRented(uint256 amount, string memory reportUri) external nonReentrant {
        IERC20Upgradeable token = IERC20Upgradeable(_acceptedToken);
        require(amount > 0, "RWN: amountIsZero");
        require(token.balanceOf(msg.sender) >= amount, "RWN: notEnoughBalance");
        require(token.transferFrom(msg.sender, address(this), amount), "RWN: transferFailed");

        _distributeEarning(msg.sender, amount);
        _totalDistributedEarnings += amount;

        emit PayOutEarningsAllRented(msg.sender, amount, reportUri);
    }

    function payOutEarnings(uint256 tokenId, uint256 amount, string memory reportUri) external nonReentrant {
        require(amount > 0, "RWN: amountIsZero");
        require(_exists(tokenId), "RWN: tokenDoesNotExi");
        require(_users[tokenId].user == msg.sender, "RWN: senderIsNotUser");

        IERC20Upgradeable token = IERC20Upgradeable(_acceptedToken);
        require(token.balanceOf(msg.sender) >= amount, "RWN: notEnoughBalance");
        require(token.transferFrom(msg.sender, address(this), amount), "RWN: transferFailed");

        _unclaimedEarnings[tokenId] += amount;
        _totalDistributedEarnings += amount;

        emit PayOutEarnings(msg.sender, tokenId, amount, reportUri);
    }

    function payOutEarningsMultiple(uint256 amount, uint256[] memory tokenIds, string memory reportUri) external nonReentrant {
        uint256 perAmount;

        require(amount > 0, "RWN: amountIsZero");
        require(tokenIds.length > 0, "RWN: tokenIdsIsZero");

        IERC20Upgradeable token = IERC20Upgradeable(_acceptedToken);
        require(token.balanceOf(msg.sender) >= amount, "RWN: notEnoughBalance");
        require(token.transferFrom(msg.sender, address(this), amount), "RWN: transferFailed");

        perAmount = amount / tokenIds.length;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_exists(tokenIds[i]), "RWN: tokenDoesNotExi");
            require(_users[tokenIds[i]].user == msg.sender, "RWN: senderIsNotUser");

            _unclaimedEarnings[tokenIds[i]] += perAmount;
        }
        _totalDistributedEarnings += amount;

        emit PayOutEarningsMultiple(msg.sender, tokenIds, amount, reportUri);
    }

    function claimEarnings(uint256 tokenId) external nonReentrant {
        require(_exists(tokenId), "RWN: tokenDoesNotExi");
        require(ownerOf(tokenId) == msg.sender, "RWN: notOwner");

        uint256 amount = _unclaimedEarnings[tokenId];
        require(amount > 0, "RWN: noEarningsToClaim");

        uint256 fee = amount * _feeRate / 10000;
        uint256 amountToUser = amount - fee;

        IERC20Upgradeable token = IERC20Upgradeable(_acceptedToken);
        require(token.balanceOf(address(this)) >= amount, "RWN: notEnoughBalance");
        require(token.transfer(msg.sender, amountToUser), "RWN: transferFailedToUser");
        require(token.transfer(owner(), fee), "RWN: transferFailedToProtocol");

        _unclaimedEarnings[tokenId] = 0;

        emit ClaimEarnings(msg.sender, tokenId, amount);
    }

    function claimEarningsAllRented() external nonReentrant returns (uint256) {
        uint256 amount = 0;
        uint256 count = 0;
        for (uint256 i = 0; i < _tokenIdCounter.current(); i++) {
            if (ownerOf(i) == msg.sender) {
                amount += _unclaimedEarnings[i];
                _unclaimedEarnings[i] = 0;
                count++;
            }
        }

        require(amount > 0, "RWN: noEarningsToClaim");
        uint256 fee = amount * _feeRate / 10000;
        uint256 amountToUser = amount - fee;

        IERC20Upgradeable token = IERC20Upgradeable(_acceptedToken);
        require(token.balanceOf(address(this)) >= amount, "RWN: notEnoughBalance");
        require(token.transfer(msg.sender, amountToUser), "RWN: transferFailedToUser");
        require(token.transfer(owner(), fee), "RWN: transferFailedToProtocol");

        emit ClaimEarningsAllRented(msg.sender, count, amount);
        return amountToUser;
    }

    function unClaimedEarnings(uint256 tokenId) external view returns (uint256) {
        require(_exists(tokenId), "RWN: tokenDoesNotExi");
        return _unclaimedEarnings[tokenId];
    }

    function unClaimedEarningsAll() external view returns (uint256) {
        uint256 amount = 0;

        for (uint256 i = 0; i < _tokenIdCounter.current(); i++) {
            if (ownerOf(i) == msg.sender) {
                amount += _unclaimedEarnings[i];
            }
        }
        // console.log("unClaimedEarningsAll: %s", amount);

        return amount;
    }

    function getAcceptedToken() external view returns (address) {
        return address(_acceptedToken);
    }

    function getBookValue() external view returns (uint256) {
        uint sec2day = 86400;
        uint256 price = _assetInfo.price;

        uint256 decliningBalance = price / (_assetInfo.usefulLife * 365);
        uint256 restOfDays = (_assetInfo.svcStartDate / sec2day + _assetInfo.usefulLife * 365) - block.timestamp / sec2day;
        
        uint256 bookValue = decliningBalance * restOfDays;

        return bookValue;
    }

    function _getRentedList(address renter) private view returns (uint256[] memory) {
        uint256 lengthOfRentedList = EnumerableSetUpgradeable.length(_rentedList[renter]);
        uint256[] memory nftIds = new uint256[](lengthOfRentedList);
        for (uint256 i = 0; i < lengthOfRentedList; i++) {
            nftIds[i] = EnumerableSetUpgradeable.at(_rentedList[renter], i);
        }
        return nftIds;
    }

    function getRentedList(address renter) public view returns (uint256[] memory) {
        return _getRentedList(renter);
    }

    function totalDistributedEarnings() external view returns (uint256) {
        return _totalDistributedEarnings;
    }

    function countOfRented() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < _tokenIdCounter.current(); i++) {
            if (_userOf(i) != address(0)) {
                count++;
            }
        }
        return count;
    }
}
