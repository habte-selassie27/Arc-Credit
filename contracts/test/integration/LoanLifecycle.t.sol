// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/CreditScoreRegistry.sol";
import "../../src/CreditLine.sol";
import "../../src/LoanVault.sol";
import "../../src/ScoreOracle.sol";
import "../../src/RepaymentScheduler.sol";
import "../../src/TranchManager.sol";
import "../mocks/MockUSDC.sol";

contract LoanLifecycleIntegrationTest is Test {
    MockUSDC usdc;
    CreditScoreRegistry registry;
    CreditLine creditLine;
    LoanVault vault;
    ScoreOracle oracle;
    TranchManager tm;
    RepaymentScheduler scheduler;
    address owner = address(0x1);
    address oracleEOA = address(0x2);
    address borrower = address(0x3);
    address lender = address(0x4);

    function setUp() public {
        usdc = new MockUSDC();
        CreditScoreRegistry regImpl = new CreditScoreRegistry();
        ERC1967Proxy regProxy = new ERC1967Proxy(address(regImpl), abi.encodeCall(CreditScoreRegistry.initialize, (owner)));
        registry = CreditScoreRegistry(address(regProxy));
        vm.prank(owner);
        registry.setOracle(oracleEOA, true);

        ScoreOracle oracleImpl = new ScoreOracle();
        ERC1967Proxy oracleProxy = new ERC1967Proxy(address(oracleImpl), abi.encodeCall(ScoreOracle.initialize, (owner, address(registry))));
        oracle = ScoreOracle(address(oracleProxy));
        vm.prank(owner);
        oracle.setTrustedBackend(oracleEOA);

        CreditLine lineImpl = new CreditLine();
        ERC1967Proxy lineProxy = new ERC1967Proxy(address(lineImpl), abi.encodeCall(CreditLine.initialize, (owner, address(registry))));
        creditLine = CreditLine(address(lineProxy));

        TranchManager tmImpl = new TranchManager();
        ERC1967Proxy tmProxy = new ERC1967Proxy(address(tmImpl), abi.encodeCall(TranchManager.initialize, (owner, address(usdc))));
        tm = TranchManager(address(tmProxy));

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
        registry.setOracle(address(oracle), true);
        vm.prank(owner);
        registry.setOracle(address(scheduler), true);

        usdc.mint(borrower, 100000e6);
        usdc.mint(lender, 200000e6);
        // seed vault liquidity correctly via deposit
        vm.startPrank(lender);
        usdc.approve(address(vault), 100000e6);
        vault.deposit(100000e6, 0);
        vm.stopPrank();
    }

    function test_fullLifecycle_applyDisburseRepayScoreUpdate() public {
        // 1. Init profile via oracle
        vm.prank(oracleEOA);
        oracle.requestScoreUpdate(borrower);
        // 2. Fulfill score -> 900
        vm.prank(oracleEOA);
        oracle.fulfillScoreUpdate(borrower, 1000, 1000, 1000, 1000, 365, true);
        assertEq(registry.getScore(borrower), 936);
        // refresh credit
        creditLine.refreshCredit(borrower);
        assertEq(creditLine.getAvailableCredit(borrower), 20000e6);

        // 3. Lender deposits to TranchManager (separate pool) and vault
        vm.startPrank(lender);
        usdc.approve(address(tm), 10000e6);
        tm.deposit(lender, 10000e6, 0);
        usdc.approve(address(vault), 50000e6);
        vault.deposit(50000e6, 0);
        vm.stopPrank();

        // 4. Borrower requests loan
        vm.prank(borrower);
        uint256 loanId = vault.requestLoan(5000e6, 30);
        assertEq(loanId, 1);
        ILoanVault.Loan memory loan = vault.getLoan(loanId);
        assertEq(loan.principal, 5000e6);
        assertEq(uint8(loan.status), 0);

        // 5. Repay
        uint256 totalDue = loan.principal + loan.interest;
        vm.startPrank(borrower);
        usdc.approve(address(vault), totalDue);
        vault.repay(loanId);
        vm.stopPrank();
        ILoanVault.Loan memory loanAfter = vault.getLoan(loanId);
        assertEq(uint8(loanAfter.status), 1);
        assertEq(vault.activeLoanId(borrower), 0);
        assertEq(creditLine.getAvailableCredit(borrower), 20000e6);
        // 6. Score after repay could be increased via oracle (simulate)
        vm.prank(oracleEOA);
        oracle.fulfillScoreUpdate(borrower, 1000, 1000, 1000, 1000, 365, true);
        assertGe(registry.getScore(borrower), 900);
    }

    function test_defaultFlow_slashesScore() public {
        vm.prank(oracleEOA);
        oracle.fulfillScoreUpdate(borrower, 1000, 1000, 1000, 1000, 365, true);
        creditLine.refreshCredit(borrower);
        vm.prank(borrower);
        uint256 loanId = vault.requestLoan(40e6, 7);
        vm.warp(block.timestamp + 7 days + 49 hours);
        scheduler.checkAndMarkDefault(loanId);
        assertEq(uint8(vault.getLoan(loanId).status), 2);
        assertEq(registry.getScore(borrower), 786); // 936-150
    }
}
