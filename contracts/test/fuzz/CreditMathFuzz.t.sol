// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/libraries/CreditMath.sol";

contract CreditMathFuzzTest is Test {
    function testFuzz_scoreAlwaysClamped(uint16 kycRaw, uint16 repRaw, uint32 repayRaw, uint96 volRaw, uint32 ageRaw) public pure {
        uint16 s = CreditMath.computeScore(kycRaw, repRaw, repayRaw, volRaw, ageRaw);
        assertLe(s, 1000);
        assertGe(s, 0);
    }

    function testFuzz_getCreditLimit_tiers(uint16 score) public pure {
        uint256 limit = CreditMath.getCreditLimit(score);
        if (score <= 299) assertEq(limit, 0);
        else if (score <= 499) assertEq(limit, 50e6);
        else if (score <= 649) assertEq(limit, 250e6);
        else if (score <= 799) assertEq(limit, 1000e6);
        else if (score <= 899) assertEq(limit, 5000e6);
        else assertEq(limit, 20000e6);
    }

    function testFuzz_getInterestRate_tiers(uint16 score) public pure {
        uint256 rate = CreditMath.getInterestRate(score);
        if (score <= 299) assertEq(rate, 0);
        else if (score <= 499) assertEq(rate, 2400);
        else if (score <= 649) assertEq(rate, 1800);
        else if (score <= 799) assertEq(rate, 1400);
        else if (score <= 899) assertEq(rate, 1000);
        else assertEq(rate, 700);
    }

    function testFuzz_slashPenalty_tiers(uint256 amount) public pure {
        uint16 p = CreditMath.getSlashPenalty(amount);
        if (amount < 50e6) assertEq(p, 150);
        else if (amount <= 1000e6) assertEq(p, 300);
        else assertEq(p, 500);
    }

    function test_usdcDecimalsConstant() public pure {
        assertEq(CreditMath.USDC_DECIMALS, 6);
    }
}
