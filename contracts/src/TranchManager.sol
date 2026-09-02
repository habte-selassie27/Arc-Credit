// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TranchManager is OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuard {
    IERC20 public usdc;

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

    TrancheInfo internal _senior;
    TrancheInfo internal _junior;

    function initialize(address owner, address _usdc) external initializer {
        __Ownable_init(owner);
        usdc = IERC20(_usdc);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function deposit(address lender, uint256 amount, uint8 tranche) external nonReentrant {
        require(tranche <= 1, "TranchManager: invalid tranche");

        if (tranche == SENIOR) {
            require(amount >= SENIOR_MIN_DEPOSIT, "TranchManager: below senior min");
            _safeTransferFrom(usdc, msg.sender, address(this), amount);
            _senior.totalShares += amount;
            _senior.totalDeposited += amount;
            _senior.shares[lender] += amount;
            _senior.depositTime[lender] = block.timestamp;
        } else {
            require(amount >= JUNIOR_MIN_DEPOSIT, "TranchManager: below junior min");
            _safeTransferFrom(usdc, msg.sender, address(this), amount);
            _junior.totalShares += amount;
            _junior.totalDeposited += amount;
            _junior.shares[lender] += amount;
            _junior.depositTime[lender] = block.timestamp;
        }

        emit Deposited(lender, amount, tranche);
    }

    function withdraw(address lender, uint256 shares, uint8 tranche) external nonReentrant {
        require(lender == msg.sender, "TranchManager: unauthorized");
        require(tranche <= 1, "TranchManager: invalid tranche");

        if (tranche == SENIOR) {
            require(_senior.shares[lender] >= shares, "TranchManager: insufficient shares");
            _senior.shares[lender] -= shares;
            _senior.totalShares -= shares;
            _senior.totalDeposited -= shares;
        } else {
            require(_junior.shares[lender] >= shares, "TranchManager: insufficient shares");
            _junior.shares[lender] -= shares;
            _junior.totalShares -= shares;
            _junior.totalDeposited -= shares;
        }

        _safeTransfer(usdc, lender, shares);

        emit Withdrawn(lender, shares, tranche);
    }

    function distributeYield(uint256 totalYield) external onlyOwner {
        uint256 seniorYield = (totalYield * SENIOR_YIELD_SHARE) / BPS_DENOMINATOR;
        uint256 juniorYield = totalYield - seniorYield;
        // Yield accounting is event-driven; USDC yield is expected to be already
        // transferred to this contract via LoanVault repay flow.
        // No self-transfer needed — previous self-transfer was a no-op bug.
        emit YieldDistributed(totalYield, seniorYield, juniorYield);
    }

    function absorbLoss(uint256 lossAmount) external onlyOwner {
        require(_junior.totalShares >= lossAmount, "TranchManager: loss exceeds junior");
        _junior.totalShares -= lossAmount;
        _junior.totalDeposited -= lossAmount;

        emit LossAbsorbed(lossAmount);
    }

    function getShares(address lender, uint8 tranche) external view returns (uint256) {
        if (tranche == SENIOR) return _senior.shares[lender];
        return _junior.shares[lender];
    }

    function getTotalShares(uint8 tranche) external view returns (uint256) {
        if (tranche == SENIOR) return _senior.totalShares;
        return _junior.totalShares;
    }

    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = address(token).call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        require(success, "USDC transfer failed");
        if (data.length > 0) require(abi.decode(data, (bool)), "USDC transfer failed");
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = address(token).call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        require(success, "USDC transferFrom failed");
        if (data.length > 0) require(abi.decode(data, (bool)), "USDC transferFrom failed");
    }

    event Deposited(address indexed lender, uint256 amount, uint8 tranche);
    event Withdrawn(address indexed lender, uint256 shares, uint8 tranche);
    event YieldDistributed(uint256 totalYield, uint256 seniorYield, uint256 juniorYield);
    event LossAbsorbed(uint256 lossAmount);
}
