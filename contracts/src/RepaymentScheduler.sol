// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/ILoanVault.sol";
import "./interfaces/ICreditScoreRegistry.sol";
import "./libraries/CreditMath.sol";

contract RepaymentScheduler is OwnableUpgradeable, UUPSUpgradeable {
    ILoanVault public loanVault;
    ICreditScoreRegistry public scoreRegistry;

    uint256 public constant GRACE_PERIOD = 48 hours;

    function initialize(
        address owner,
        address _loanVault,
        address _scoreRegistry
    ) external initializer {
        __Ownable_init(owner);
        loanVault = ILoanVault(_loanVault);
        scoreRegistry = ICreditScoreRegistry(_scoreRegistry);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function checkAndMarkDefault(uint256 loanId) external {
        ILoanVault.Loan memory loan = loanVault.getLoan(loanId);
        require(loan.status == ILoanVault.LoanStatus.ACTIVE, "Scheduler: not active");
        require(block.timestamp > loan.dueTimestamp + GRACE_PERIOD, "Scheduler: grace period");

        loanVault.markDefault(loanId);

        uint16 penalty = CreditMath.getSlashPenalty(loan.principal);
        scoreRegistry.slashScore(loan.borrower, penalty);
        scoreRegistry.incrementDefaulted(loan.borrower);

        emit LoanDefaulted(loanId, loan.borrower, loan.principal, penalty);
    }

    function setLoanVault(address _loanVault) external onlyOwner {
        loanVault = ILoanVault(_loanVault);
    }

    function setScoreRegistry(address _scoreRegistry) external onlyOwner {
        scoreRegistry = ICreditScoreRegistry(_scoreRegistry);
    }

    event LoanDefaulted(uint256 indexed loanId, address indexed borrower, uint256 principal, uint16 penalty);
}
