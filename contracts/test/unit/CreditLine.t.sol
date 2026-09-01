// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/CreditScoreRegistry.sol";
import "../../src/CreditLine.sol";

contract CreditLineTest is Test {
    CreditScoreRegistry registry;
    CreditLine creditLine;
    address owner = address(0x1);
    address oracle = address(0x2);
    address user = address(0x3);
    address vault = address(0x4);

    function setUp() public {
        CreditScoreRegistry regImpl = new CreditScoreRegistry();
        ERC1967Proxy regProxy = new ERC1967Proxy(address(regImpl), abi.encodeCall(CreditScoreRegistry.initialize, (owner)));
        registry = CreditScoreRegistry(address(regProxy));
        vm.prank(owner);
        registry.setOracle(oracle, true);

        CreditLine lineImpl = new CreditLine();
        ERC1967Proxy lineProxy = new ERC1967Proxy(address(lineImpl), abi.encodeCall(CreditLine.initialize, (owner, address(registry))));
        creditLine = CreditLine(address(lineProxy));
        vm.prank(owner);
        creditLine.setVault(vault, true);

        // init user profile
        vm.prank(oracle);
        registry.initProfile(user);
    }

    function _setScore(uint16 s) internal {
        vm.prank(oracle);
        registry.setScore(user, s, false);
        // refreshCredit to sync availableCredit
        creditLine.refreshCredit(user);
    }

    function test_scoreUnder300_returns0() public {
        _setScore(299);
        assertEq(creditLine.getCreditLimit(user), 0);
        _setScore(0);
        assertEq(creditLine.getCreditLimit(user), 0);
    }

    function test_score300_499_returns50() public {
        _setScore(300);
        assertEq(creditLine.getCreditLimit(user), 50e6);
        _setScore(499);
        assertEq(creditLine.getCreditLimit(user), 50e6);
    }

    function test_score500_649_returns250() public {
        _setScore(500);
        assertEq(creditLine.getCreditLimit(user), 250e6);
        _setScore(649);
        assertEq(creditLine.getCreditLimit(user), 250e6);
    }

    function test_score650_799_returns1000() public {
        _setScore(650);
        assertEq(creditLine.getCreditLimit(user), 1000e6);
        _setScore(799);
        assertEq(creditLine.getCreditLimit(user), 1000e6);
    }

    function test_score800_899_returns5000() public {
        _setScore(800);
        assertEq(creditLine.getCreditLimit(user), 5000e6);
        _setScore(899);
        assertEq(creditLine.getCreditLimit(user), 5000e6);
    }

    function test_score900plus_returns20000() public {
        _setScore(900);
        assertEq(creditLine.getCreditLimit(user), 20000e6);
        _setScore(1000);
        assertEq(creditLine.getCreditLimit(user), 20000e6);
    }

    function test_lockCredit_reducesAvailable() public {
        _setScore(800); // 5000
        assertEq(creditLine.getAvailableCredit(user), 5000e6);
        vm.prank(vault);
        creditLine.lockCredit(user, 1000e6);
        assertEq(creditLine.getAvailableCredit(user), 4000e6);
    }

    function test_doubleBorrow_reverts() public {
        _setScore(800);
        vm.prank(vault);
        creditLine.lockCredit(user, 100e6);
        // set active loan
        vm.prank(vault);
        creditLine.setActiveLoan(user, 1);
        vm.prank(vault);
        vm.expectRevert("CreditLine: active loan exists");
        creditLine.lockCredit(user, 10e6);
    }

    function test_refreshCredit_handlesScoreDrop() public {
        // Start high then drop low — should not underflow (old bug)
        _setScore(900); // 20000
        vm.prank(vault);
        creditLine.lockCredit(user, 5000e6); // lock 5000, available 15000
        assertEq(creditLine.getAvailableCredit(user), 15000e6);
        // drop score to 0 -> newLimit 0, locked = 5000, so available should become 0 not revert
        vm.prank(oracle);
        registry.setScore(user, 0, false);
        // refresh should not revert
        creditLine.refreshCredit(user);
        assertEq(creditLine.getAvailableCredit(user), 0);
        assertEq(creditLine.creditLimit(user), 0);
    }

    function test_releaseCredit_capsAtLimit() public {
        _setScore(500); // 250
        vm.prank(vault);
        creditLine.lockCredit(user, 100e6);
        assertEq(creditLine.getAvailableCredit(user), 150e6);
        vm.prank(vault);
        creditLine.releaseCredit(user, 200e6); // would be 350 but limit 250
        assertEq(creditLine.getAvailableCredit(user), 250e6);
    }

    function test_unauthorizedVaultReverts() public {
        vm.prank(user);
        vm.expectRevert("CreditLine: unauthorized vault");
        creditLine.lockCredit(user, 10e6);
    }

    function test_getInterestRate_tiers() public {
        _setScore(200);
        assertEq(creditLine.getInterestRate(user), 0);
        _setScore(400);
        assertEq(creditLine.getInterestRate(user), 2400);
        _setScore(600);
        assertEq(creditLine.getInterestRate(user), 1800);
        _setScore(700);
        assertEq(creditLine.getInterestRate(user), 1400);
        _setScore(850);
        assertEq(creditLine.getInterestRate(user), 1000);
        _setScore(950);
        assertEq(creditLine.getInterestRate(user), 700);
    }
}
