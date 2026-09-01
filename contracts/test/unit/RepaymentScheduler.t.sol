// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/CreditScoreRegistry.sol";
import "../../src/CreditLine.sol";
import "../../src/LoanVault.sol";
import "../../src/RepaymentScheduler.sol";
import "../mocks/MockUSDC.sol";

contract RepaymentSchedulerTest is Test {
    MockUSDC usdc;
    CreditScoreRegistry registry;
    CreditLine creditLine;
    LoanVault vault;
    RepaymentScheduler scheduler;
    address owner = address(0x1);
    address oracle = address(0x2);
    address borrower = address(0x3);

    function setUp() public {
        usdc = new MockUSDC();
        CreditScoreRegistry regImpl = new CreditScoreRegistry();
        ERC1967Proxy regProxy = new ERC1967Proxy(address(regImpl), abi.encodeCall(CreditScoreRegistry.initialize, (owner)));
        registry = CreditScoreRegistry(address(regProxy));
        vm.prank(owner);
        registry.setOracle(oracle, true);

        CreditLine lineImpl = new CreditLine();
        ERC1967Proxy lineProxy = new ERC1967Proxy(address(lineImpl), abi.encodeCall(CreditLine.initialize, (owner, address(registry))));
        creditLine = CreditLine(address(lineProxy));

        LoanVault vaultImpl = new LoanVault();
        ERC1967Proxy vaultProxy = new ERC1967Proxy(address(vaultImpl), abi.encodeCall(LoanVault.initialize, (owner, address(usdc), address(creditLine))));
        vault = LoanVault(address(vaultProxy));

        RepaymentScheduler schedImpl = new RepaymentScheduler();
        ERC1967Proxy schedProxy = new ERC1967Proxy(address(schedImpl), abi.encodeCall(RepaymentScheduler.initialize, (owner, address(vault), address(registry))));
        scheduler = RepaymentScheduler(address(schedProxy));

        vm.prank(owner);
        creditLine.setVault(address(vault), true);
        vm.prank(owner);
        vault.setRepaymentScheduler(address(scheduler));
        vm.prank(owner);
        registry.setOracle(address(scheduler), true);

        // borrower score
        vm.prank(oracle);
        registry.initProfile(borrower);
        vm.prank(oracle);
        registry.setScore(borrower, 900, true);
        creditLine.refreshCredit(borrower);
        usdc.mint(borrower, 100000e6);
        // seed vault liquidity
        address seedLender = address(0x99);
        usdc.mint(seedLender, 200000e6);
        vm.startPrank(seedLender);
        usdc.approve(address(vault), 200000e6);
        vault.deposit(200000e6, 0);
        vm.stopPrank();
    }

    function test_checkAndMarkDefault_beforeGrace_reverts() public {
        vm.prank(borrower);
        uint256 loanId = vault.requestLoan(40e6, 7); // <50 => penalty 150
        vm.expectRevert("Scheduler: grace period");
        scheduler.checkAndMarkDefault(loanId);
        // also vault's markDefault before grace would revert, but scheduler checks first
    }

    function test_checkAndMarkDefault_afterGrace_marksDefaultAndSlashes() public {
        vm.prank(borrower);
        uint256 loanId = vault.requestLoan(40e6, 7);
        // score before
        assertEq(registry.getScore(borrower), 900);
        vm.warp(block.timestamp + 7 days + 49 hours);
        // should succeed
        vm.expectEmit(true, true, true, true);
        emit RepaymentScheduler.LoanDefaulted(loanId, borrower, 40e6, 150);
        scheduler.checkAndMarkDefault(loanId);
        // loan status
        ILoanVault.Loan memory loan = vault.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(ILoanVault.LoanStatus.DEFAULTED));
        // score slashed 150 -> 750
        assertEq(registry.getScore(borrower), 750);
        // defaultedLoans incremented
        ICreditScoreRegistry.CreditProfile memory p = registry.getProfile(borrower);
        assertEq(p.defaultedLoans, 1);
    }

    function test_correctSlashPenalty_perLoanSize() public {
        // <50 ->150
        vm.prank(borrower);
        uint256 loanId1 = vault.requestLoan(40e6, 7);
        vm.warp(block.timestamp + 7 days + 49 hours);
        scheduler.checkAndMarkDefault(loanId1);
        assertEq(registry.getScore(borrower), 750); // 900-150

        // need to reset borrower for second loan: repay needed? But defaulted, active 0, can borrow again after score drop? Score 750 still 1000 limit, so can borrow 500
        // Need to mint new borrower2 for clean test of 500 penalty
        address borrower2 = address(0x4);
        vm.prank(oracle);
        registry.initProfile(borrower2);
        vm.prank(oracle);
        registry.setScore(borrower2, 900, true);
        creditLine.refreshCredit(borrower2);
        usdc.mint(borrower2, 100000e6);
        vm.prank(borrower2);
        uint256 loanId2 = vault.requestLoan(100e6, 14); // 50-1000 =>300
        vm.warp(block.timestamp + 14 days + 49 hours);
        scheduler.checkAndMarkDefault(loanId2);
        assertEq(registry.getScore(borrower2), 600); // 900-300

        address borrower3 = address(0x5);
        vm.prank(oracle);
        registry.initProfile(borrower3);
        vm.prank(oracle);
        registry.setScore(borrower3, 900, true);
        creditLine.refreshCredit(borrower3);
        usdc.mint(borrower3, 100000e6);
        vm.prank(borrower3);
        uint256 loanId3 = vault.requestLoan(5000e6, 30); // >1000 =>500
        vm.warp(block.timestamp + 30 days + 49 hours);
        scheduler.checkAndMarkDefault(loanId3);
        assertEq(registry.getScore(borrower3), 400);
    }

    function test_scoreCannotGoBelowZero() public {
        // borrower with score 140, borrow 40 => penalty 150 -> 0
        address low = address(0x6);
        vm.prank(oracle);
        registry.initProfile(low);
        vm.prank(oracle);
        registry.setScore(low, 300, false); // limit 50, can borrow 40
        creditLine.refreshCredit(low);
        usdc.mint(low, 100000e6);
        vm.prank(low);
        uint256 loanId = vault.requestLoan(40e6, 7);
        // lower score before default to 100
        vm.prank(oracle);
        registry.setScore(low, 100, false);
        vm.warp(block.timestamp + 7 days + 49 hours);
        scheduler.checkAndMarkDefault(loanId);
        assertEq(registry.getScore(low), 0);
    }
}
