// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICreditScoreRegistry {
    struct CreditProfile {
        uint16  score;
        uint32  lastUpdated;
        uint32  totalLoans;
        uint32  repaidLoans;
        uint32  defaultedLoans;
        uint96  totalVolumeUSDC;
        bool    arcPassVerified;
    }

    function getScore(address borrower) external view returns (uint16);
    function getProfile(address borrower) external view returns (CreditProfile memory);
    function updateScore(address borrower) external;
    function slashScore(address borrower, uint16 penalty) external;
    function initProfile(address borrower) external;
    function incrementDefaulted(address borrower) external;
    function setScore(address borrower, uint16 newScore, bool arcPassVerified) external;
    function setOracle(address oracle, bool authorized) external;
}
