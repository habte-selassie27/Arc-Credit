// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library InterestLib {
    uint256 constant USDC_DECIMALS = 6;
    uint256 constant SECONDS_PER_DAY = 86400;
    uint256 constant DAYS_PER_YEAR = 365;
    uint256 constant BPS_DENOMINATOR = 10000;
    uint256 constant PROTOCOL_FEE_BPS = 1000;
    uint256 constant LENDER_YIELD_BPS = 9000;

    function computeInterest(
        uint256 principal,
        uint256 aprBps,
        uint256 termDays
    ) internal pure returns (uint256 interest) {
        interest = (principal * aprBps * termDays) / (DAYS_PER_YEAR * BPS_DENOMINATOR);
    }

    function computeTotalDue(
        uint256 principal,
        uint256 interest
    ) internal pure returns (uint256) {
        return principal + interest;
    }

    function computeProtocolFee(uint256 interest) internal pure returns (uint256) {
        return (interest * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
    }

    function computeLenderYield(uint256 interest) internal pure returns (uint256) {
        return (interest * LENDER_YIELD_BPS) / BPS_DENOMINATOR;
    }
}
