// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/TranchManager.sol";
import "../mocks/MockUSDC.sol";

contract TranchManagerTest is Test {
    MockUSDC usdc;
    TranchManager tm;
    address owner = address(0x1);
    address lender = address(0x2);

    function setUp() public {
        usdc = new MockUSDC();
        TranchManager impl = new TranchManager();
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), abi.encodeCall(TranchManager.initialize, (owner, address(usdc))));
        tm = TranchManager(address(proxy));
        usdc.mint(lender, 100000e6);
    }

    function test_deposit_senior_min() public {
        vm.startPrank(lender);
        usdc.approve(address(tm), 10e6);
        tm.deposit(lender, 10e6, 0);
        vm.stopPrank();
        assertEq(tm.getShares(lender, 0), 10e6);
        assertEq(tm.getTotalShares(0), 10e6);
    }

    function test_deposit_junior_min() public {
        vm.startPrank(lender);
        usdc.approve(address(tm), 5e6);
        tm.deposit(lender, 5e6, 1);
        vm.stopPrank();
        assertEq(tm.getShares(lender, 1), 5e6);
    }

    function test_deposit_belowMin_reverts() public {
        vm.startPrank(lender);
        usdc.approve(address(tm), 9e6);
        vm.expectRevert("TranchManager: below senior min");
        tm.deposit(lender, 9e6, 0);
        usdc.approve(address(tm), 4e6);
        vm.expectRevert("TranchManager: below junior min");
        tm.deposit(lender, 4e6, 1);
        vm.stopPrank();
    }

    function test_withdraw_reducesShares() public {
        vm.startPrank(lender);
        usdc.approve(address(tm), 20e6);
        tm.deposit(lender, 20e6, 0);
        tm.withdraw(lender, 5e6, 0);
        vm.stopPrank();
        assertEq(tm.getShares(lender, 0), 15e6);
        assertEq(tm.getTotalShares(0), 15e6);
    }

    function test_withdraw_insufficientReverts() public {
        vm.startPrank(lender);
        usdc.approve(address(tm), 10e6);
        tm.deposit(lender, 10e6, 0);
        vm.expectRevert("TranchManager: insufficient shares");
        tm.withdraw(lender, 20e6, 0);
        vm.stopPrank();
    }

    function test_distributeYield_emits() public {
        vm.startPrank(lender);
        usdc.approve(address(tm), 20e6);
        tm.deposit(lender, 20e6, 0);
        vm.stopPrank();
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit TranchManager.YieldDistributed(100e6, 60e6, 40e6);
        tm.distributeYield(100e6);
    }

    function test_absorbLoss_reducesJunior() public {
        vm.startPrank(lender);
        usdc.approve(address(tm), 50e6);
        tm.deposit(lender, 50e6, 1);
        vm.stopPrank();
        vm.prank(owner);
        tm.absorbLoss(10e6);
        assertEq(tm.getTotalShares(1), 40e6);
    }

    function test_absorbLoss_exceedsJuniorReverts() public {
        vm.startPrank(lender);
        usdc.approve(address(tm), 10e6);
        tm.deposit(lender, 10e6, 1);
        vm.stopPrank();
        vm.prank(owner);
        vm.expectRevert("TranchManager: loss exceeds junior");
        tm.absorbLoss(20e6);
    }

    function test_invalidTrancheReverts() public {
        vm.startPrank(lender);
        usdc.approve(address(tm), 10e6);
        vm.expectRevert("TranchManager: invalid tranche");
        tm.deposit(lender, 10e6, 2);
        vm.stopPrank();
    }
}
