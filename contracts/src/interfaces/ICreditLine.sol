// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICreditLine {
    function getCreditLimit(address borrower) external view returns (uint256);
    function getAvailableCredit(address borrower) external view returns (uint256);
    function lockCredit(address borrower, uint256 amount) external;
    function releaseCredit(address borrower, uint256 amount) external;
    function getInterestRate(address borrower) external view returns (uint256);
    function setActiveLoan(address borrower, uint256 loanId) external;
    function setVault(address vault, bool authorized) external;
}
