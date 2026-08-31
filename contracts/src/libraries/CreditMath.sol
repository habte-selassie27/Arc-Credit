// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

library CreditMath {
    uint256 constant USDC_DECIMALS = 6;
    uint256 constant MAX_SCORE = 1000;

    uint256 constant KYC_WEIGHT = 250;
    uint256 constant REP_WEIGHT = 200;
    uint256 constant HISTORY_WEIGHT = 300;
    uint256 constant VOLUME_WEIGHT = 150;
    uint256 constant AGE_WEIGHT = 100;

    uint16 constant TIER_1_MAX = 299;
    uint16 constant TIER_2_MAX = 499;
    uint16 constant TIER_3_MAX = 649;
    uint16 constant TIER_4_MAX = 799;
    uint16 constant TIER_5_MAX = 899;

    uint256 constant CREDIT_TIER_2 = 50e6;
    uint256 constant CREDIT_TIER_3 = 250e6;
    uint256 constant CREDIT_TIER_4 = 1000e6;
    uint256 constant CREDIT_TIER_5 = 5000e6;
    uint256 constant CREDIT_TIER_6 = 20000e6;

    uint256 constant APR_TIER_2 = 2400;
    uint256 constant APR_TIER_3 = 1800;
    uint256 constant APR_TIER_4 = 1400;
    uint256 constant APR_TIER_5 = 1000;
    uint256 constant APR_TIER_6 = 700;

    function computeScore(
        uint16 kycRaw,
        uint16 repRaw,
        uint32 repaymentRaw,
        uint96 volumeRaw,
        uint32 ageRaw
    ) internal pure returns (uint16) {
        uint256 kycPts = (uint256(kycRaw) * KYC_WEIGHT) / 1000;
        uint256 repPts = (uint256(repRaw) * REP_WEIGHT) / 1000;
        uint256 histPts = (uint256(repaymentRaw) * HISTORY_WEIGHT) / 1000;
        uint256 volPts = (uint256(volumeRaw) * VOLUME_WEIGHT) / 1000;
        uint256 agePts = (uint256(ageRaw) * AGE_WEIGHT) / 1000;

        uint256 total = kycPts + repPts + histPts + volPts + agePts;

        if (total > MAX_SCORE) {
            total = MAX_SCORE;
        }
        return uint16(total);
    }

    function getCreditLimit(uint16 score) internal pure returns (uint256) {
        if (score <= TIER_1_MAX) return 0;
        if (score <= TIER_2_MAX) return CREDIT_TIER_2;
        if (score <= TIER_3_MAX) return CREDIT_TIER_3;
        if (score <= TIER_4_MAX) return CREDIT_TIER_4;
        if (score <= TIER_5_MAX) return CREDIT_TIER_5;
        return CREDIT_TIER_6;
    }

    function getInterestRate(uint16 score) internal pure returns (uint256) {
        if (score <= TIER_1_MAX) return 0;
        if (score <= TIER_2_MAX) return APR_TIER_2;
        if (score <= TIER_3_MAX) return APR_TIER_3;
        if (score <= TIER_4_MAX) return APR_TIER_4;
        if (score <= TIER_5_MAX) return APR_TIER_5;
        return APR_TIER_6;
    }

    function getSlashPenalty(uint256 loanAmount) internal pure returns (uint16) {
        if (loanAmount < 50e6) return 150;
        if (loanAmount <= 1000e6) return 300;
        return 500;
    }
}
