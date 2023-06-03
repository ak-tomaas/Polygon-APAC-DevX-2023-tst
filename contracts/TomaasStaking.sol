// SPDX-License-Identifier: BSL-1.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";

import "./TomaasRWN.sol";
import "./TomaasLPN.sol";

contract TomaasStaking is 
    Initializable,
    ReentrancyGuardUpgradeable, 
    OwnableUpgradeable,
    PausableUpgradeable,
    IERC721ReceiverUpgradeable
{
    struct InfoTRN {
        TomaasRWN tomaasRWN; // address of collection
        IERC20Upgradeable acceptedToken; // first we use USDC, later we will use Another Token
        uint revenueShareRatio; // revenue share ratio for collection owner 10000 = 100%, 4000 = 40%, 1 = 0.01%
    }

    struct InfoTLN {
        TomaasLPN tomaasLPN; // address of collection
        IERC20Upgradeable acceptedToken; // first we use USDC, later we will use Another Token
        uint256 price; // price to mint TLN
        uint[] interestRates; // interest rates for collection owner 10000 = 100%, 4000 = 40%, 1 = 0.01%
        uint256[] rewardsPerDay; //rewards per day
    }

    //list allowd TRN
    mapping(uint16 => InfoTRN) private _TRNs;
    uint16 private _countOfTRNs;

    //list allowd TLN
    mapping(uint16 => InfoTLN) private _TLNs;
    uint16 private _countOfTLNs;
    
    //list TRNs to purchase
    //nftaddress => tokenId
    mapping(address => EnumerableSetUpgradeable.UintSet) private _listOfTRNsToPurchase;
    mapping(address => uint256) _priceOfTRN;

    //list of TRNs owned by this contract
    //nftaddress => tokenId
    mapping(address => EnumerableSetUpgradeable.UintSet) private _listOfTRNsOwned;

    mapping(address => mapping(uint => uint256)) private _settlementDates;
    mapping(address => uint) private _countOfSettlementDates;


    //Can't mint TLN if they don't have TRN to buy, 
    //so let's just accept the extra minting
    //list of TLNs to wait to stake
    //nftaddress => tokenId
    //mapping(address => EnumerableSetUpgradeable.UintSet) private _listOfTLNsToStake;

    //tlnAddr => staker address => tokenIds
    mapping(address => mapping(address => EnumerableSetUpgradeable.UintSet)) private _listOfTLNsStaked;
    
    //tlnAddr => staker => lastClaimDate
    mapping(address => mapping(address => uint256)) private _lastClaimDate;

    uint256 private _totalClaimedRewards; // from TRNs
    uint256 private _balanceOfRewards; //rest of the amount after claiming from TLN stakers

    uint256 private _totalStakedTokens; // from TLNs
    uint256 private _balanceOfStaked; //rest of the amount after buying TRNs

    event AddTRNAddress(address indexed trnAddr, address acceptedToken, uint revenueShareRatio);
    event ClaimFromTRNs(address indexed trnAddr, uint256 amount, uint256 countOfTRNs);
    event SellTRNsToPool(address indexed trnAddr, address indexed buyer, uint256[] tokenIds);
    event AddTLNAddress(address indexed tlnAddr, address tokenAddr, uint256 price, uint[] rates);
    event StakeTLNs(address indexed tlnAddr, address indexed staker, uint256[] tokenIds);
    event UnstakeTLNs(address indexed tlnAddr, address indexed staker, uint256 tokenId);
    event Claim(address indexed tlnAddr, address indexed staker, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() initializer public {
        __Pausable_init();
        __Ownable_init();
        __ReentrancyGuard_init();
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
    
    function _existTRN(address trnAddr) internal view returns (bool) {
        require(trnAddr != address(0), "LP: trnAddr=0");
        if (_countOfTRNs == 0) return false;
        for (uint16 i = 0; i < _countOfTRNs; i++) {
            if (address(_TRNs[i].tomaasRWN) == trnAddr) {
                return true;
            }
        }
        return false;
    }

    function addTRNAddress(address trnAddr, 
                          address acceptedToken, 
                          uint revenueShareRatio
    ) public onlyOwner {
        _TRNs[_countOfTRNs].tomaasRWN = TomaasRWN(trnAddr);
        _TRNs[_countOfTRNs].acceptedToken = IERC20Upgradeable(acceptedToken);
        _TRNs[_countOfTRNs].revenueShareRatio = revenueShareRatio;
        _countOfTRNs++;

        emit AddTRNAddress(trnAddr, acceptedToken, revenueShareRatio);
    }

    function listTRNAddress() public view returns (InfoTRN[] memory) {
        InfoTRN[] memory trns = new InfoTRN[](_countOfTRNs);
        for (uint16 i = 0; i < _countOfTRNs; i++) {
            trns[i] = _TRNs[i];
        }
        return trns;
    }

    function getInfoTRN(address trnAddr) public view returns (InfoTRN memory infoTRN) {
        for (uint16 i = 0; i < _countOfTRNs; i++) {
            if (address(_TRNs[i].tomaasRWN) == trnAddr) {
                return _TRNs[i];
            }
        }
        require(false, "TS: TRN not exist");
    }

    function claimFromTRNs(address trnAddr) public onlyOwner nonReentrant {
        require(_existTRN(trnAddr), "TS: TRN not exist");
        uint256 countOfTRNs = EnumerableSetUpgradeable.length(_listOfTRNsOwned[trnAddr]);        
        require( countOfTRNs > 0, "TS: No TRNs owned");

        TomaasRWN trn = TomaasRWN(trnAddr);
        uint256 amount = trn.claimEarningsAllRented();

        if (amount == 0) {
            return;
        }
        _totalClaimedRewards += amount;
        _balanceOfRewards += amount; 

        _settlementDates[trnAddr][_countOfSettlementDates[trnAddr]] = block.timestamp;
        _countOfSettlementDates[trnAddr]++;

        emit ClaimFromTRNs(trnAddr, amount, countOfTRNs);
    }

    function lengthOfTRNsToPurchase(address trnAddr) public view returns (uint256 length) {
        require(_existTRN(trnAddr), "TS: TRN not exist");
        return EnumerableSetUpgradeable.length(_listOfTRNsToPurchase[trnAddr]);
    }

    function setPriceOfTRN(address trnAddr, uint256 price) public onlyOwner {
        require(_existTRN(trnAddr), "TS: TRN not exist");
        _priceOfTRN[trnAddr] = price;
    }

    /**
     * @dev It's called after TLNs are stake to this contract
     */
    function buyTRNsFromList(address trnAddr) public onlyOwner nonReentrant {
      uint256 length;
      InfoTRN memory infoTRN = getInfoTRN(trnAddr);

      length = EnumerableSetUpgradeable.length(_listOfTRNsToPurchase[trnAddr]);
      require(length> 0, "TS: No TRNs to purchase");

      uint256 priceOfTRN = _priceOfTRN[trnAddr];
      require(priceOfTRN > 0, "TS: Price of TRN not set");

      uint256 amountOfListing = length * priceOfTRN;
      uint256 quantityForPurchase;

      if (_balanceOfStaked >= amountOfListing) {
        quantityForPurchase = length;
      } else {
        quantityForPurchase = _balanceOfStaked / priceOfTRN;
      }

      TomaasRWN trn = TomaasRWN(trnAddr);
      uint256 amount = quantityForPurchase * priceOfTRN;
      require(_balanceOfStaked >= amount, "TS: Not enough staked tokens");

      IERC20Upgradeable token = infoTRN.acceptedToken; //it's from TomaasRWN's acceptedToken
      require(token.balanceOf(address(this)) >= amount, "TM: not enough token balance");

      uint256[] memory soldTokenIds = new uint256[](quantityForPurchase);

      for (uint256 i = 0; i < quantityForPurchase; i++) {
        uint256 tokenId = EnumerableSetUpgradeable.at(_listOfTRNsToPurchase[trnAddr], i);
        address owner = trn.ownerOf(tokenId);
        trn.safeTransferFrom(owner, address(this), tokenId);
        token.transfer(owner, priceOfTRN);
        EnumerableSetUpgradeable.add(_listOfTRNsOwned[trnAddr], tokenId);
        soldTokenIds[i] = tokenId;
      }

      //remove sold tokens from _listOfTRNsToPurchase
      for (uint256 i = 0; i < soldTokenIds.length; i++) {
        EnumerableSetUpgradeable.remove(_listOfTRNsToPurchase[trnAddr], soldTokenIds[i]); 
      }

      _balanceOfStaked -= amount;

      emit SellTRNsToPool(trnAddr, address(this), soldTokenIds);
    }

    function sellTRNsToPool(address trnAddr, uint256[] memory tokenIds) 
        public 
        nonReentrant 
        whenNotPaused 
    {
      require(_existTRN(trnAddr), "TS: TRN not exist");
      require(tokenIds.length > 0, "TS: No TRNs to sell");

      TomaasRWN trn = TomaasRWN(trnAddr);
      require(trn.isApprovedForAll(msg.sender, address(this)), "TS: Not approved for all");

      uint256 priceOfTRN = _priceOfTRN[trnAddr];
      require(priceOfTRN > 0, "TS: Price of TRN not set");

      uint256 amountOfListing = tokenIds.length * priceOfTRN;
      uint256 quantityForPurchase;
      uint256 remaining = 0;

      if (_balanceOfStaked >= amountOfListing) {
        quantityForPurchase = tokenIds.length;
      } else {
        quantityForPurchase = _balanceOfStaked / priceOfTRN;
        remaining = tokenIds.length - quantityForPurchase;
      }

      //purchase quantity of TRNs and add the remaining TRNs to _listOfTRNsToPurchase 
      uint256 amount = quantityForPurchase * priceOfTRN;
      IERC20Upgradeable token = getInfoTRN(trnAddr).acceptedToken; //it's from TomaasRWN's acceptedToken
      require(token.balanceOf(address(this)) >= amount, "TM: not enough token balance");

      uint256[] memory soldTokenIds = new uint256[](quantityForPurchase);
      for (uint256 i = 0; i < quantityForPurchase; i++) {
        uint256 tokenId = tokenIds[i];
        address owner = trn.ownerOf(tokenId);
        require(owner == address(this), "TS: TRN not owned by pool");
        trn.safeTransferFrom(owner, address(this), tokenId);
        EnumerableSetUpgradeable.add(_listOfTRNsToPurchase[trnAddr], tokenId);
        EnumerableSetUpgradeable.remove(_listOfTRNsOwned[trnAddr], tokenId); 
        soldTokenIds[i] = tokenId;
      }
      token.transfer(msg.sender, amount);
      _balanceOfRewards -= amount;

      //add the remaining TRNs to _listOfTRNsToPurchase
      if (remaining > 0) {
        uint256 start = tokenIds.length - remaining;
        for (uint256 i = start; i < tokenIds.length; i++) {
          uint256 tokenId = tokenIds[i];
          EnumerableSetUpgradeable.add(_listOfTRNsToPurchase[trnAddr], tokenId);
        }
      }

      emit SellTRNsToPool(trnAddr, address(this), soldTokenIds);
    }

    function _existTLN(address tlnAddr) internal view returns (bool) {
      require(tlnAddr != address(0), "TS: tlnAddr=0");
      if (_countOfTRNs == 0) return false;
      for (uint16 i = 0; i < _countOfTLNs; i++) {
        if (address(_TLNs[i].tomaasLPN) == tlnAddr) {
          return true;
        }
      }
      return false;
    }

    function getInfoTLN(address tlnAddr) public view returns (InfoTLN memory infoTLN) {
      for (uint16 i = 0; i < _countOfTLNs; i++) {
        if (address(_TLNs[i].tomaasLPN) == tlnAddr) {
          return _TLNs[i];
        }
      }
      require(false, "TS: TLN not exist");
    }

    /**
     * [0,  1,  2,    3,  4,  5,   6,   7,   8,   9,   10]
     * [1%, 5%, 5.5%, 6%, 7%, 8%, 9.5%, 11%, 13%, 15%, 18%]
     * [100,500,550,  600,700,800, 950, 1100,1300,1500,1800]
     * @dev Add a new TLN address 
     * @param tlnAddr  address of TLN
     * @param tokenAddr address of accepted token
     * @param price price of TLN
     * @param rates revenue share ratios of TLN [1%, 5%, 5.5%, 6%, 7%, 8%, 9.5%, 11%, 13%, 15%, 18%]
     */
    function addTLNAddress(address tlnAddr, 
                          address tokenAddr, 
                          uint256 price, 
                          uint[] memory rates
    ) public onlyOwner 
    {
      require(!_existTLN(tlnAddr), "TS: TLN already exist");
      require(price > 0, "TS: price=0");
      require(rates.length > 0, "TS: rates length=0");

      //get interest rates from infoTLN
      uint lengthOfRates = rates.length;

      _TLNs[_countOfTLNs].interestRates = new uint[](lengthOfRates);
      _TLNs[_countOfTLNs].rewardsPerDay = new uint256[](lengthOfRates);

      for (uint i=0; i<lengthOfRates; i++) {
        _TLNs[_countOfTLNs].interestRates[i] = rates[i];
        _TLNs[_countOfTLNs].rewardsPerDay[i] = (price * rates[i] / 10000) / 365;
      }

      _TLNs[_countOfTLNs].tomaasLPN = TomaasLPN(tlnAddr);
      _TLNs[_countOfTLNs].acceptedToken = IERC20Upgradeable(tokenAddr);
      _TLNs[_countOfTLNs].price = price;
      _countOfTLNs++;

      emit AddTLNAddress(tlnAddr, tokenAddr, price, rates);
    }

    //tlnAddr => staker => {date, amount}
    struct HistoryStake {
        uint256 date;
        uint256 countOfStaked;
    }
    mapping(address => mapping(address => mapping(uint256 => HistoryStake))) private _stakeHistory;
    mapping(address => mapping(address => uint256)) private _countOfStakeHistory;

    function listOfTLNs(address tlnAddr) public view returns (uint256[] memory tokenIds) {
      require(_existTLN(tlnAddr), "TS: TLN not exist");
      uint256 length = EnumerableSetUpgradeable.length(_listOfTLNsStaked[tlnAddr][msg.sender]);
      if (length == 0) return new uint256[](0); //return empty array

      tokenIds = new uint256[](length);
      for (uint256 i = 0; i < length; i++) {
        tokenIds[i] = EnumerableSetUpgradeable.at(_listOfTLNsStaked[tlnAddr][msg.sender], i);
      }
      return tokenIds;
    }

    function totalStakedTokens() public view returns (uint256) {
      return _totalStakedTokens;
    }

    function stakeTLNs(address tlnAddr, uint256[] memory tokenIds) public nonReentrant whenNotPaused {
      InfoTLN memory infoTLN = getInfoTLN(tlnAddr);
      TomaasLPN tln = infoTLN.tomaasLPN;

      require(tokenIds.length > 0, "TS: No TLNs to stake");
      require(tln.isApprovedForAll(msg.sender, address(this)), 
                "TS: Not approved for all");

      uint256 amountToStake = tokenIds.length * infoTLN.price;
      require(infoTLN.acceptedToken.balanceOf(address(tlnAddr)) >= amountToStake, 
                "TS: not enough token balance");

      //tranfer TLNs to pool
      //tranfer accepted token to pool
      //add TLNs to _listOfTLNsStaked
      for (uint256 i = 0; i < tokenIds.length; i++) {
        uint256 tokenId = tokenIds[i];
        tln.safeTransferFrom(msg.sender, address(this), tokenId);
        tln.withdraw(tokenId);

        EnumerableSetUpgradeable.add(_listOfTLNsStaked[tlnAddr][msg.sender], tokenId);
      }

      _totalStakedTokens += tokenIds.length;
      _balanceOfStaked += amountToStake;

      if(_countOfStakeHistory[tlnAddr][msg.sender] == 0) {
        _lastClaimDate[tlnAddr][msg.sender] = block.timestamp;
      }

      _stakeHistory[tlnAddr][msg.sender][_countOfStakeHistory[tlnAddr][msg.sender]].date = block.timestamp;
      _stakeHistory[tlnAddr][msg.sender][_countOfStakeHistory[tlnAddr][msg.sender]].countOfStaked = _totalStakedTokens;
      _countOfStakeHistory[tlnAddr][msg.sender] += 1;

      emit StakeTLNs(tlnAddr, msg.sender, tokenIds);
    }

    function unStakeTLN(address tlnAddr, uint256 tokenId) public nonReentrant whenNotPaused {
      InfoTLN memory infoTLN = getInfoTLN(tlnAddr);
      TomaasLPN tln = infoTLN.tomaasLPN;

      //Must be one month after first stake date, last unstake date

      //ask claim rewards before unstake

      uint256 amountToUnStake = infoTLN.price;
      require(infoTLN.acceptedToken.balanceOf(address(this)) >= amountToUnStake, 
                "TS: not enough token balance");

      tln.safeTransferFrom(address(this), msg.sender, tokenId);
      tln.depositToken(tokenId);

      EnumerableSetUpgradeable.remove(_listOfTLNsStaked[tlnAddr][msg.sender], tokenId);

      _totalStakedTokens -= 1;
      _balanceOfStaked -= amountToUnStake;

      _stakeHistory[tlnAddr][msg.sender][_countOfStakeHistory[tlnAddr][msg.sender]].date = block.timestamp;
      _stakeHistory[tlnAddr][msg.sender][_countOfStakeHistory[tlnAddr][msg.sender]].countOfStaked = _totalStakedTokens;
      _countOfStakeHistory[tlnAddr][msg.sender] += 1;

      emit UnstakeTLNs(tlnAddr, msg.sender, tokenId);
    }

    //find get index over date of stakeHistory
    function _getIndexStakeHistory(address tlnAddr, 
                                  address staker, 
                                  uint256 lastClaimDate
    ) internal view returns (uint256) 
    {
      uint256 index = 0;
      uint256 countOfStakeHistory = _countOfStakeHistory[tlnAddr][staker];
      for (uint256 i = 0; i < countOfStakeHistory; i++) {
        if (_stakeHistory[tlnAddr][staker][i].date >= lastClaimDate) {
          index = i;
          break;
        }
      }
      return index;
    }

    function _calcRewardsForDuration(uint duration, 
                                    uint countOfStaked, 
                                    uint256[] memory rewardsPerDay
    ) internal pure returns (uint256) 
    {
      uint256 rewards = 0;
      uint256 countOfMaxRatesGroup = countOfStaked / rewardsPerDay.length;

      uint durationDay = duration / 86400;
      rewards += (durationDay * countOfMaxRatesGroup * rewardsPerDay[rewardsPerDay.length - 1]);

      uint restOfStaked = countOfStaked % rewardsPerDay.length;
      //start from index 1, 0 index is optional
      rewards += (durationDay * restOfStaked * rewardsPerDay[restOfStaked]);

      return rewards;
    }

    function _lastSettlementDate() internal view returns (uint256) {
      uint256 lastSettlementDate = 0;
      for (uint16 i = 0; i < _countOfTRNs; i++) {
        address trnAddr = address(_TRNs[i].tomaasRWN);
        if (_settlementDates[trnAddr][_countOfSettlementDates[trnAddr] - 1] > lastSettlementDate) {
          lastSettlementDate = _settlementDates[trnAddr][_countOfSettlementDates[trnAddr] - 1];
        }
      }
      return lastSettlementDate;
    }

    function _calculateRewards(address tlnAddr, address staker) internal view returns (uint256) {
      uint256 amount = 0;
      // //check count of staked tokens
      // //get info from
      // uint256 length = EnumerableSetUpgradeable.length(_listOfTLNsStaked[tlnAddr][staker]);
      // amount = length * getInfoTLN(tlnAddr).price;
      
      //get last claim date of staker;
      uint256 lastClaimDate = _lastClaimDate[tlnAddr][staker];

      //After test net, add this require
      //uint256 lastSettlementDate = _lastSettlementDate();
      //require(lastClaimDate < lastSettlementDate, "TS: last claim date must be less than last settlement date");

      //get list of staked/unstaked history from last claim date
      uint256 index = _getIndexStakeHistory(tlnAddr, staker, lastClaimDate);
      uint256 countOfStakeHistory = _countOfStakeHistory[tlnAddr][staker];
      // console.log("index: %s, countOfStakeHistory: %s", index, countOfStakeHistory);

      uint duration = 0;
      uint countOfStaked = 0;

      if (0 == countOfStakeHistory - 1) {
          //last staked info
          duration = block.timestamp - _stakeHistory[tlnAddr][staker][0].date;
          countOfStaked = _stakeHistory[tlnAddr][staker][0].countOfStaked;
          amount += _calcRewardsForDuration(duration, countOfStaked, getInfoTLN(tlnAddr).rewardsPerDay);
      }
      else {
        for (uint i = countOfStakeHistory - 1; i >= index; i--) {
          uint nextDate;
          // console.log("i: %s", i);
          if (i == countOfStakeHistory - 1) {
            nextDate = block.timestamp;
          }
          else {
            nextDate = _stakeHistory[tlnAddr][staker][i + 1].date;
          }
          duration = nextDate - _stakeHistory[tlnAddr][staker][i].date;
          countOfStaked = _stakeHistory[tlnAddr][staker][i].countOfStaked;
          // console.log("duration: %s, countOfStaked: %s", duration, countOfStaked);
          //duration, countOfStaked, _TLNs[_countOfTLNs].rewardsPerDay
          amount += _calcRewardsForDuration(duration, countOfStaked, getInfoTLN(tlnAddr).rewardsPerDay);

          //it need to prevent overflow
          if (i==0) break;
        }
      }
      
      return amount; 
    }

    function remainingRewards(address tlnAddr) public view returns (uint256) {
      return _calculateRewards(tlnAddr, msg.sender);
    }

    //claim rewards
    function claim(address tlnAddr) public nonReentrant whenNotPaused {
      require(_balanceOfRewards > 0, "TS: no staked tokens");

      uint256 amount = _calculateRewards(tlnAddr, msg.sender);
      require(amount > 0, "TS: amount=0");

      _balanceOfRewards -= amount;
      _lastClaimDate[tlnAddr][msg.sender] = block.timestamp;

      InfoTLN memory infoTLN = getInfoTLN(tlnAddr);
      require(infoTLN.acceptedToken.transfer(msg.sender, amount), "TS: transfer token failed");

      // console.log("claim amount: %s", amount);
      emit Claim(tlnAddr, msg.sender, amount);
    }

    function totalClaimedRewards() external view returns (uint256) {
      return _totalClaimedRewards;
    }
    
    function balanceOfRewards() external view returns (uint256) {
      return _balanceOfRewards;
    }

    function onERC721Received(address operator, 
                              address from, 
                              uint256 tokenId, 
                              bytes calldata data
    ) public view returns(bytes4) 
    {
      operator;
      from;
      tokenId;
      data;
      return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    }
}
 