// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract TranchManager is OwnableUpgradeable, ReentrancyGuardUpgradeable {
    IERC20Upgradeable public usdc;

    uint8 public constant SENIOR = 0;
    uint8 public constant JUNIOR = 1;

    uint256 public constant SENIOR_YIELD_SHARE = 60;
    uint256 public constant JUNIOR_YIELD_SHARE = 40;
    uint256 public constant BPS_DENOMINATOR = 100;
    uint256 public constant SENIOR_MIN_DEPOSIT = 10e6;
    uint256 public constant JUNIOR_MIN_DEPOSIT = 5e6;

    struct TrancheInfo {
        uint256 totalShares;
        uint256 totalDeposited;
        mapping(address => uint256) shares;
        mapping(address => uint256) depositTime;
    }

    TrancheInfo public senior;
    TrancheInfo public junior;

    function initialize(address owner, address _usdc) external initializer {
        __Ownable_init(owner);
        __ReentrancyGuard_init();
        usdc = IERC20Upgradeable(_usdc);
    }

    function deposit(address lender, uint256 amount, uint8 tranche) external nonReentrant {
        require(tranche <= 1, "TranchManager: invalid tranche");

        if (tranche == SENIOR) {
            require(amount >= SENIOR_MIN_DEPOSIT, "TranchManager: below senior min");
            usdc.transferFrom(msg.sender, address(this), amount);
            senior.totalShares += amount;
            senior.totalDeposited += amount;
            senior.shares[lender] += amount;
            senior.depositTime[lender] = block.timestamp;
        } else {
            require(amount >= JUNIOR_MIN_DEPOSIT, "TranchManager: below junior min");
            usdc.transferFrom(msg.sender, address(this), amount);
            junior.totalShares += amount;
            junior.totalDeposited += amount;
            junior.shares[lender] += amount;
            junior.depositTime[lender] = block.timestamp;
        }

        emit Deposited(lender, amount, tranche);
    }

    function withdraw(address lender, uint256 shares, uint8 tranche) external nonReentrant {
        require(tranche <= 1, "TranchManager: invalid tranche");

        if (tranche == SENIOR) {
            require(senior.shares[lender] >= shares, "TranchManager: insufficient shares");
            senior.shares[lender] -= shares;
            senior.totalShares -= shares;
            senior.totalDeposited -= shares;
        } else {
            require(junior.shares[lender] >= shares, "TranchManager: insufficient shares");
            junior.shares[lender] -= shares;
            junior.totalShares -= shares;
            junior.totalDeposited -= shares;
        }

        usdc.transfer(lender, shares);

        emit Withdrawn(lender, shares, tranche);
    }

    function distributeYield(uint256 totalYield) external onlyOwner {
        uint256 seniorYield = (totalYield * SENIOR_YIELD_SHARE) / BPS_DENOMINATOR;
        uint256 juniorYield = totalYield - seniorYield;

        if (senior.totalShares > 0) {
            usdc.transfer(address(this), seniorYield);
        }
        if (junior.totalShares > 0) {
            usdc.transfer(address(this), juniorYield);
        }

        emit YieldDistributed(totalYield, seniorYield, juniorYield);
    }

    function absorbLoss(uint256 lossAmount) external onlyOwner {
        require(junior.totalShares >= lossAmount, "TranchManager: loss exceeds junior");
        junior.totalShares -= lossAmount;
        junior.totalDeposited -= lossAmount;

        emit LossAbsorbed(lossAmount);
    }

    function getShares(address lender, uint8 tranche) external view returns (uint256) {
        if (tranche == SENIOR) return senior.shares[lender];
        return junior.shares[lender];
    }

    function getTotalShares(uint8 tranche) external view returns (uint256) {
        if (tranche == SENIOR) return senior.totalShares;
        return junior.totalShares;
    }

    event Deposited(address indexed lender, uint256 amount, uint8 tranche);
    event Withdrawn(address indexed lender, uint256 shares, uint8 tranche);
    event YieldDistributed(uint256 totalYield, uint256 seniorYield, uint256 juniorYield);
    event LossAbsorbed(uint256 lossAmount);
}
