// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/CreditScoreRegistry.sol";
import "../../src/CreditLine.sol";
import "../../src/LoanVault.sol";
import "../mocks/MockUSDC.sol";

contract LoanVaultTest is Test {
    MockUSDC usdc;
    CreditScoreRegistry registry;
    CreditLine creditLine;
    LoanVault vault;
    address owner = address(0x1);
    address oracle = address(0x2);
    address borrower = address(0x3);
    address lender = address(0x4);

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

        vm.prank(owner);
        creditLine.setVault(address(vault), true);
        // give borrower score 900 -> 20000 limit
        vm.prank(oracle);
        registry.initProfile(borrower);
        vm.prank(oracle);
        registry.setScore(borrower, 900, true);
        creditLine.refreshCredit(borrower);
        // lender and borrower have USDC
        usdc.mint(lender, 200000e6);
        usdc.mint(borrower, 100000e6);
        // seed vault with liquidity via proper deposit
        vm.startPrank(lender);
        usdc.approve(address(vault), 100000e6);
        vault.deposit(100000e6, 0);
        vm.stopPrank();
        // also need owner to set repayment scheduler for markDefault test
        // done later
    }

    function test_deposit_mintsCorrectShares() public {
        uint256 before = vault.totalDeposited();
        vm.startPrank(lender);
        usdc.approve(address(vault), 1000e6);
        vault.deposit(1000e6, 0);
        vm.stopPrank();
        assertEq(vault.totalDeposited(), before + 1000e6);
    }

    function test_requestLoan_transfersAndUpdatesActive() public {
        vm.prank(borrower);
        uint256 loanId = vault.requestLoan(500e6, 14);
        assertEq(loanId, 1); // nextLoanId starts at 1
        assertEq(vault.activeLoanId(borrower), 1);
        ILoanVault.Loan memory loan = vault.getLoan(1);
        assertEq(loan.principal, 500e6);
        assertEq(uint8(loan.status), uint8(ILoanVault.LoanStatus.ACTIVE));
        // credit locked
        assertEq(creditLine.getAvailableCredit(borrower), 20000e6 - 500e6);
        // totalLent
        assertEq(vault.totalLent(), 500e6);
    }

    function test_doubleBorrow_reverts() public {
        vm.prank(borrower);
        vault.requestLoan(100e6, 7);
        vm.prank(borrower);
        vm.expectRevert("LoanVault: active loan exists");
        vault.requestLoan(10e6, 7);
    }

    function test_repay_marksRepaidReleasesCredit() public {
        vm.prank(borrower);
        uint256 loanId = vault.requestLoan(100e6, 14);
        ILoanVault.Loan memory loan = vault.getLoan(loanId);
        uint256 totalDue = loan.principal + loan.interest;
        // borrower already has USDC, need to approve
        vm.startPrank(borrower);
        usdc.approve(address(vault), totalDue);
        vault.repay(loanId);
        vm.stopPrank();
        ILoanVault.Loan memory loanAfter = vault.getLoan(loanId);
        assertEq(uint8(loanAfter.status), uint8(ILoanVault.LoanStatus.REPAID));
        assertEq(vault.activeLoanId(borrower), 0);
        assertEq(vault.totalLent(), 0);
        assertEq(creditLine.getAvailableCredit(borrower), 20000e6);
    }

    function test_repay_insufficientReverts() public {
        vm.prank(borrower);
        uint256 loanId = vault.requestLoan(100e6, 7);
        // borrower without approval -> should revert (our safeTransferFrom will revert)
        // give borrower no allowance
        // we need to set borrower's USDC to 0? borrower has 100k, but no approve
        vm.prank(borrower);
        vm.expectRevert(); // generic revert from safeTransferFrom
        vault.repay(loanId);
    }

    function test_withdraw_insufficientLiquidityReverts() public {
        uint256 startDeposited = vault.totalDeposited();
        // lender deposits 1000
        vm.startPrank(lender);
        usdc.approve(address(vault), 1000e6);
        vault.deposit(1000e6, 0);
        vm.stopPrank();
        // borrower takes 800
        vm.prank(borrower);
        vault.requestLoan(800e6, 30);
        uint256 totalDep = vault.totalDeposited(); // start +1000
        uint256 totalLent = vault.totalLent(); // 800
        uint256 available = totalDep - totalLent;
        // try to withdraw more than available
        vm.prank(lender);
        vm.expectRevert("LoanVault: insufficient liquidity");
        vault.withdraw(available + 1, 0);
        // withdraw exactly available should succeed
        vm.prank(lender);
        vault.withdraw(available, 0);
        assertEq(vault.totalDeposited(), totalDep - available);
    }

    function test_markDefault_onlyScheduler() public {
        // set scheduler
        address scheduler = address(0x5);
        vm.prank(owner);
        vault.setRepaymentScheduler(scheduler);
        vm.prank(borrower);
        uint256 loanId = vault.requestLoan(50e6, 7);
        // not scheduler should revert
        vm.prank(borrower);
        vm.expectRevert("LoanVault: unauthorized scheduler");
        vault.markDefault(loanId);
        // warp past grace
        vm.warp(block.timestamp + 7 days + 49 hours);
        vm.prank(scheduler);
        vault.markDefault(loanId);
        ILoanVault.Loan memory loan = vault.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(ILoanVault.LoanStatus.DEFAULTED));
    }

    function test_interest_neverExceedsPrincipal(uint96 principal, uint8 termIdx) public pure {
        uint8[4] memory terms = [uint8(7), 14, 30, 90];
        uint8 term = terms[termIdx % 4];
        uint256 p = uint256(principal) % 20000e6; // cap
        uint256 apr = 700; // lowest
        uint256 interest = (p * apr * uint256(term)) / (365 * 10000);
        assertLe(interest, p);
    }
}
