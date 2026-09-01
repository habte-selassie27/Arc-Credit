// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../src/libraries/InterestLib.sol";

contract InterestLibFuzzTest is Test {
    function testFuzz_interestNeverExceedsPrincipal(uint96 principal, uint16 score, uint8 termIdx) public pure {
        uint8[4] memory terms = [uint8(7), 14, 30, 90];
        uint8 term = terms[termIdx % 4];
        uint256 p = uint256(principal) % 20000e6;
        if (p == 0) p = 1e6;
        // use worst APR 2400
        uint256 interest = InterestLib.computeInterest(p, 2400, term);
        assertLe(interest, p, "interest should never exceed principal for max APR");
        // also test with actual APR per tier
        uint256 apr;
        if (score <= 299) apr = 0;
        else if (score <= 499) apr = 2400;
        else if (score <= 649) apr = 1800;
        else if (score <= 799) apr = 1400;
        else if (score <= 899) apr = 1000;
        else apr = 700;
        uint256 interest2 = InterestLib.computeInterest(p, apr, term);
        assertLe(interest2, p);
    }

    function testFuzz_totalDueIsPrincipalPlusInterest(uint96 principal, uint8 termIdx) public pure {
        uint8[4] memory terms = [uint8(7), 14, 30, 90];
        uint8 term = terms[termIdx % 4];
        uint256 p = uint256(principal) % 10000e6 + 1e6;
        uint256 interest = InterestLib.computeInterest(p, 1000, term);
        uint256 total = InterestLib.computeTotalDue(p, interest);
        assertEq(total, p + interest);
    }

    function testFuzz_protocolFeePlusYieldEqualsInterest(uint96 interestRaw) public pure {
        uint256 interest = uint256(interestRaw) % 100000e6;
        uint256 fee = InterestLib.computeProtocolFee(interest);
        uint256 yld = InterestLib.computeLenderYield(interest);
        // rounding may cause off-by-1 due to integer division
        assertApproxEqAbs(fee + yld, interest, 1);
        assertEq(fee, interest * 1000 / 10000);
        assertEq(yld, interest * 9000 / 10000);
    }

    function test_usdcDecimals() public pure {
        assertEq(InterestLib.USDC_DECIMALS, 6);
        assertEq(InterestLib.SECONDS_PER_DAY, 86400);
        assertEq(InterestLib.DAYS_PER_YEAR, 365);
    }
}
