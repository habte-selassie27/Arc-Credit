// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/ICreditScoreRegistry.sol";
import "./interfaces/ICreditLine.sol";
import "./libraries/CreditMath.sol";

contract CreditLine is ICreditLine, OwnableUpgradeable {
    ICreditScoreRegistry public scoreRegistry;

    mapping(address => uint256) public creditLimit;
    mapping(address => uint256) public availableCredit;
    mapping(address => uint256) public activeLoanId;
    mapping(address => bool) public authorizedVaults;

    function initialize(address owner, address _scoreRegistry) external initializer {
        __Ownable_init(owner);
        scoreRegistry = ICreditScoreRegistry(_scoreRegistry);
    }

    modifier onlyAuthorizedVault() {
        require(authorizedVaults[msg.sender], "CreditLine: unauthorized vault");
        _;
    }

    function getCreditLimit(address borrower) external view override returns (uint256) {
        uint16 score = scoreRegistry.getScore(borrower);
        return CreditMath.getCreditLimit(score);
    }

    function getAvailableCredit(address borrower) external view override returns (uint256) {
        return availableCredit[borrower];
    }

    function getInterestRate(address borrower) external view override returns (uint256) {
        uint16 score = scoreRegistry.getScore(borrower);
        return CreditMath.getInterestRate(score);
    }

    function refreshCredit(address borrower) external {
        uint256 newLimit = getCreditLimit(borrower);
        creditLimit[borrower] = newLimit;

        uint256 locked = newLimit - availableCredit[borrower];
        if (newLimit < locked) {
            availableCredit[borrower] = 0;
        } else {
            availableCredit[borrower] = newLimit - locked;
        }
    }

    function lockCredit(address borrower, uint256 amount) external override onlyAuthorizedVault {
        require(availableCredit[borrower] >= amount, "CreditLine: insufficient credit");
        require(activeLoanId[borrower] == 0, "CreditLine: active loan exists");
        availableCredit[borrower] -= amount;
    }

    function releaseCredit(address borrower, uint256 amount) external override onlyAuthorizedVault {
        uint256 newAvail = availableCredit[borrower] + amount;
        uint256 limit = creditLimit[borrower];
        if (newAvail > limit) {
            availableCredit[borrower] = limit;
        } else {
            availableCredit[borrower] = newAvail;
        }
    }

    function setActiveLoan(address borrower, uint256 loanId) external onlyAuthorizedVault {
        activeLoanId[borrower] = loanId;
    }

    function setVault(address vault, bool authorized) external onlyOwner {
        authorizedVaults[vault] = authorized;
    }

    function setScoreRegistry(address _scoreRegistry) external onlyOwner {
        scoreRegistry = ICreditScoreRegistry(_scoreRegistry);
    }
}
