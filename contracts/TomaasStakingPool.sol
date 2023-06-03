// SPDX-License-Identifier: BSL-1.0
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/utils/ERC721HolderUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./TomaasLPN.sol";
import "./TomaasRWN.sol";
import "./TomaasMarketplace.sol";

import "hardhat/console.sol";

interface ITokenForRewards is IERC20Upgradeable {
    // may be not used
    function mint(address to, uint256 amount) external;
}

contract TomaasStakingPool is
    Initializable,
    ERC721HolderUpgradeable,
    OwnableUpgradeable
{
    ITokenForRewards public tokenForRewards;
    // IERC721Upgradeable public liquidityProviderNft;
    TomaasLPN public liquidityProviderNft;
    TomaasRWN public realWorldNft;
    TomaasMarketplace public marketplace;

    // [ Data of Staking Pool Contract ]
    bool public rewardsClaimable;
    bool stakingInitialized;

    uint256 public stakingStartTime;
    uint256 public stakedTotal;

    uint256 constant stakingTime = 180 seconds;
    uint256 constant token = 10e18;

    // [ Data of Staker ]
    mapping(address => Staker) public stakerMap;

    mapping(uint256 => address) public tokenOwnerMap;

    struct Staker {
        uint256[] tokenIds;
        mapping(uint256 => uint256) tokenStakingCoolDown;
        uint256 rewardsBalance;
        uint256 rewardsReleased;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice event emitted when a user has staked a nft
    event Staked(address owner, uint256 amount);

    /// @notice event emitted when a user has unstaked a nft
    event Unstaked(address owner, uint256 amount);

    /// @notice event emitted when a user claims reward
    event RewardPaid(address indexed user, uint256 reward);

    /// @notice Allows reward tokens to be claimed
    event ClaimableStatusUpdated(bool status);

    /// @notice Emergency unstake tokens without rewards
    event EmergencyUnstake(address indexed user, uint256 tokenId);

    // function initialize() initializer public {
    function initialize(TomaasLPN _liquidityProviderNft, ITokenForRewards _tokenForRewards, TomaasMarketplace _marketplace) initializer public {
        __Ownable_init();
        tokenForRewards = _tokenForRewards;
        liquidityProviderNft = _liquidityProviderNft;
        marketplace = _marketplace;
    }

    function initStaking() public onlyOwner {
        require(!stakingInitialized, "Staking is already initialized.");
        stakingStartTime = block.timestamp;
        stakingInitialized = true;
    }

    function setRewardsClaimable(bool _enabled) public onlyOwner {
        rewardsClaimable = _enabled;
        emit ClaimableStatusUpdated(_enabled);
    }

    // Staking
    function getStakedTokens(address _userAddress) public view returns (uint256[] memory tokenids) {
        return stakerMap[_userAddress].tokenIds;
    }

    function getOwnerOfStakedToken(uint256 _tokenId) public view returns (address owner) {
        return tokenOwnerMap[_tokenId];
    }

    function stakeToken(uint256 tokenId) public {
        require(
            block.timestamp >= stakingStartTime,
            "Staking Pool is not initialized yet"
        );
        stake(msg.sender, tokenId);
    }

    function stakeTokens(uint256[] memory tokenIds) public {
        require(
            block.timestamp >= stakingStartTime,
            "Staking Pool is not initialized yet"
        );
        for (uint256 i = 0; i < tokenIds.length; i++) {
            stake(msg.sender, tokenIds[i]);
        }
    }

    function stake(address _userAddress, uint256 _tokenId) internal {
        require(
            stakingInitialized,
            "Staking Pool is not initialized yet"
        );
        require(
            liquidityProviderNft.ownerOf(_tokenId) == _userAddress,
            "The User is not the owner of this token"
        );

        Staker storage staker = stakerMap[_userAddress];
        staker.tokenIds.push(_tokenId);
        staker.tokenStakingCoolDown[_tokenId] = block.timestamp;
        
        tokenOwnerMap[_tokenId] = _userAddress;

        liquidityProviderNft.approve(address(this), _tokenId);
        liquidityProviderNft.safeTransferFrom(_userAddress, address(this), _tokenId);

        // get erc20 from staked nft
        liquidityProviderNft.withdraw(_tokenId);
        
        emit Staked(_userAddress, _tokenId);
        stakedTotal++;

    }

    function unstakeToken(uint256 _tokenId) public {
        require(
            tokenOwnerMap[_tokenId] == msg.sender,
            "Sender is not the owner of the token"
        );
        // have to claim Rewards that msg.sender has.
        // claimRewards(msg.sender);
        unstake(msg.sender, _tokenId);
    }

    function unstakeTokens(uint256[] memory tokenIds) public {
        // have to claim Rewards that msg.sender has.
        // claimRewards(msg.sender);
        for (uint256 i=0; i < tokenIds.length; i++) {
            require(
                tokenOwnerMap[tokenIds[i]] == msg.sender,
                "Sender is not the owner of the token"
            );
            unstake(msg.sender, tokenIds[i]);
        }
    }

    function unstakeAllTokens() public {
        // have to claim Rewards that msg.sender has.
        // claimRewards(msg.sender);
        console.log(msg.sender);
        uint256[] memory tokenIds = stakerMap[msg.sender].tokenIds;
        for (uint256 i = 0; i < tokenIds.length; i++) {
            console.log(tokenIds.length);
            unstake(msg.sender, tokenIds[i]);
        }
    }

    function unstake(address _userAddress, uint256 _tokenId) internal {
        require(
            tokenOwnerMap[_tokenId] == _userAddress,
            "The User is not the owner of this token"
        );

        Staker storage staker = stakerMap[_userAddress];

        staker.tokenStakingCoolDown[_tokenId] = 0;
        delete tokenOwnerMap[_tokenId];

        liquidityProviderNft.safeTransferFrom(address(this), _userAddress, _tokenId);

        emit Unstaked(_userAddress, _tokenId);
        stakedTotal--;

        uint256 lastIndex = staker.tokenIds.length - 1;
        uint256 lastValue = staker.tokenIds[lastIndex];
        if (lastValue == _tokenId) {
            staker.tokenIds.pop();
        } else {
            if (staker.tokenIds.length > 0) {
                for (uint256 i = 0; i < staker.tokenIds.length; i++) {
                    if(staker.tokenIds[i] == _tokenId) {
                        staker.tokenIds[i] = lastValue;
                        staker.tokenIds.pop();
                    }
                }
            }
        }
    }

    // function removeElementByValue(uint256 _value, uint256[] memory tokenIds) internal {
    //     uint[] storage array;

    //     for (uint256 i = 0; i < tokenIds.length; i++) {
    //         if (tokenIds[i] != _value) {
    //             array.push(tokenIds[i]);
    //         }
    //     }
    // }

}