// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILoanVault {
    enum LoanStatus { ACTIVE, REPAID, DEFAULTED }

    struct Loan {
        address  borrower;
        uint256  principal;
        uint256  interest;
        uint256  dueTimestamp;
        uint8    termDays;
        LoanStatus status;
    }

    function deposit(uint256 amount, uint8 tranche) external;
    function withdraw(uint256 shares, uint8 tranche) external;
    function claimYield() external;
    function requestLoan(uint256 amount, uint8 termDays) external returns (uint256 loanId);
    function repay(uint256 loanId) external;
    function markDefault(uint256 loanId) external;
    function getLoan(uint256 loanId) external view returns (Loan memory);
    function totalDeposited() external view returns (uint256);
    function totalLent() external view returns (uint256);
}
