// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/CreditScoreRegistry.sol";
import "../../src/CreditLine.sol";
import "../../src/LoanVault.sol";
import "../../src/ScoreOracle.sol";
import "../../src/TranchManager.sol";
import "../../src/RepaymentScheduler.sol";
import "../mocks/MockUSDC.sol";

contract BranchCoverageTest is Test {
    MockUSDC usdc;
    CreditScoreRegistry registry;
    CreditLine creditLine;
    LoanVault vault;
    ScoreOracle oracle;
    TranchManager tm;
    RepaymentScheduler scheduler;
    address owner = address(0x1);
    address oracleEOA = address(0x2);
    address user = address(0x3);
    address vaultAddr = address(0x4);
    address lender = address(0x5);

    function setUp() public {
        usdc = new MockUSDC();
        CreditScoreRegistry regImpl = new CreditScoreRegistry();
        ERC1967Proxy regProxy = new ERC1967Proxy(address(regImpl), abi.encodeCall(CreditScoreRegistry.initialize, (owner)));
        registry = CreditScoreRegistry(address(regProxy));
        vm.prank(owner);
        registry.setOracle(oracleEOA, true);
        vm.prank(owner);
        registry.setOracle(address(0x99), true); // for scheduler later

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

        // seed
        usdc.mint(user, 100000e6);
        usdc.mint(lender, 200000e6);
        usdc.mint(address(0x99), 100000e6);
        // seed vault liquidity
        vm.startPrank(lender);
        usdc.approve(address(vault), 100000e6);
        vault.deposit(100000e6, 0);
        vm.stopPrank();
        // user profile
        vm.prank(oracleEOA);
        registry.initProfile(user);
        vm.prank(oracleEOA);
        registry.setScore(user, 900, true);
        creditLine.refreshCredit(user);
    }

    // CreditScoreRegistry branches
    function test_Registry_incrementLoans() public {
        vm.prank(oracleEOA);
        registry.incrementLoans(user);
        ICreditScoreRegistry.CreditProfile memory p = registry.getProfile(user);
        assertEq(p.totalLoans, 1);
        vm.prank(user);
        vm.expectRevert("CreditScore: unauthorized oracle");
        registry.incrementLoans(user);
    }
    function test_Registry_incrementRepaid() public {
        vm.prank(oracleEOA);
        registry.incrementRepaid(user, 100e6);
        ICreditScoreRegistry.CreditProfile memory p = registry.getProfile(user);
        assertEq(p.repaidLoans, 1);
        assertEq(p.totalVolumeUSDC, 100e6);
    }
    function test_Registry_incrementDefaulted() public {
        vm.prank(oracleEOA);
        registry.incrementDefaulted(user);
        assertEq(registry.getProfile(user).defaultedLoans, 1);
    }
    function test_Registry_setOracle_onlyOwner() public {
        vm.prank(user);
        vm.expectRevert();
        registry.setOracle(address(0x10), true);
        vm.prank(owner);
        registry.setOracle(address(0x10), true);
        assertTrue(registry.authorizedOracles(address(0x10)));
    }
    function test_Registry_getScore_zero() public view {
        assertEq(registry.getScore(address(0x999)), 0);
    }

    // CreditLine branches
    function test_CreditLine_refreshCredit_bothBranches() public {
        // already high score 900 -> 20000, lock 5000
        vm.prank(address(vault));
        creditLine.lockCredit(user, 5000e6);
        // case 1: newLimit <= locked (drop to 0)
        vm.prank(oracleEOA);
        registry.setScore(user, 0, false);
        creditLine.refreshCredit(user); // should set available 0
        assertEq(creditLine.getAvailableCredit(user), 0);
        // case 2: newLimit > locked (raise)
        vm.prank(oracleEOA);
        registry.setScore(user, 900, true);
        creditLine.refreshCredit(user); // new 20000, locked 20000? Actually old limit 0, locked 0? Let's reset
        // After previous, creditLimit 0, available 0, locked 0, new 20000 -> available 20000
        assertEq(creditLine.getAvailableCredit(user), 20000e6);
    }
    function test_CreditLine_lockCredit_insufficient() public {
        vm.prank(address(vault));
        vm.expectRevert("CreditLine: insufficient credit");
        creditLine.lockCredit(user, 30000e6);
    }
    function test_CreditLine_releaseCredit_bothBranches() public {
        // lock 5000, then release 2000 (newAvail 15000+2000=17000 <= limit 20000 -> else branch)
        vm.prank(address(vault));
        creditLine.lockCredit(user, 5000e6);
        vm.prank(address(vault));
        creditLine.releaseCredit(user, 2000e6);
        assertEq(creditLine.getAvailableCredit(user), 20000e6 - 5000e6 + 2000e6);
        // release that exceeds limit -> cap
        vm.prank(address(vault));
        creditLine.releaseCredit(user, 10000e6);
        assertEq(creditLine.getAvailableCredit(user), 20000e6);
    }
    function test_CreditLine_setVault_onlyOwner() public {
        vm.prank(user);
        vm.expectRevert();
        creditLine.setVault(address(0x10), true);
    }
    function test_CreditLine_setScoreRegistry_onlyOwner() public {
        vm.prank(user);
        vm.expectRevert();
        creditLine.setScoreRegistry(address(0x10));
    }

    // LoanVault branches
    function test_Vault_deposit_zeroReverts() public {
        vm.prank(lender);
        vm.expectRevert("LoanVault: zero deposit");
        vault.deposit(0, 0);
    }
    function test_Vault_withdraw_zeroReverts() public {
        vm.prank(lender);
        vm.expectRevert("LoanVault: zero shares");
        vault.withdraw(0, 0);
    }
    function test_Vault_requestLoan_zeroAmountReverts() public {
        vm.prank(user);
        vm.expectRevert("LoanVault: zero amount");
        vault.requestLoan(0, 7);
    }
    function test_Vault_requestLoan_invalidTermReverts() public {
        vm.prank(user);
        vm.expectRevert("LoanVault: invalid term");
        vault.requestLoan(10e6, 15);
    }
    function test_Vault_requestLoan_insufficientCreditReverts() public {
        // user has 20000, try 30000
        vm.prank(user);
        vm.expectRevert("LoanVault: insufficient credit");
        vault.requestLoan(30000e6, 7);
    }
    function test_Vault_requestLoan_insufficientLiquidityReverts() public {
        // Use small vault: withdraw most liquidity to leave 10000, then loan 8000, second loan 3000 should exceed
        // First withdraw down to 10000
        uint256 currentDep = vault.totalDeposited();
        uint256 toWithdraw = currentDep - 10000e6;
        if (toWithdraw > 0) {
            vm.prank(lender);
            // need to ensure lender has shares? Lender deposited 100k, so can withdraw
            // Use owner to withdraw? Actually lender is the depositor, but totalDeposited is from lender, so lender can withdraw
            // For simplicity, use a fresh vault with small deposit
            // Deploy fresh small vault
            MockUSDC smallUsdc = new MockUSDC();
            CreditScoreRegistry smallReg = registry;
            CreditLine smallLine = creditLine;
            LoanVault smallVaultImpl = new LoanVault();
            ERC1967Proxy smallProxy = new ERC1967Proxy(address(smallVaultImpl), abi.encodeCall(LoanVault.initialize, (owner, address(smallUsdc), address(smallLine))));
            LoanVault smallVault = LoanVault(address(smallProxy));
            vm.prank(owner);
            smallLine.setVault(address(smallVault), true);
            // give borrowers score
            address b1 = address(0x66);
            address b2 = address(0x67);
            vm.prank(oracleEOA);
            smallReg.initProfile(b1);
            vm.prank(oracleEOA);
            smallReg.setScore(b1, 900, true);
            smallLine.refreshCredit(b1);
            vm.prank(oracleEOA);
            smallReg.initProfile(b2);
            vm.prank(oracleEOA);
            smallReg.setScore(b2, 900, true);
            smallLine.refreshCredit(b2);
            smallUsdc.mint(b1, 100000e6);
            smallUsdc.mint(b2, 100000e6);
            address smallLender = address(0x68);
            smallUsdc.mint(smallLender, 20000e6);
            vm.startPrank(smallLender);
            smallUsdc.approve(address(smallVault), 10000e6);
            smallVault.deposit(10000e6, 0);
            vm.stopPrank();
            // b1 takes 8000
            vm.prank(b1);
            smallVault.requestLoan(8000e6, 7);
            // b2 tries 3000 -> total 11000 >10000 should revert liquidity (not credit, since limit 20000)
            vm.prank(b2);
            vm.expectRevert("LoanVault: insufficient liquidity");
            smallVault.requestLoan(3000e6, 7);
            return;
        }
        // fallback original logic if not enough to withdraw
        address borrower2 = address(0x6);
        vm.prank(oracleEOA);
        registry.initProfile(borrower2);
        vm.prank(oracleEOA);
        registry.setScore(borrower2, 900, true);
        creditLine.refreshCredit(borrower2);
        usdc.mint(borrower2, 1000e6);
        vm.prank(user);
        vault.requestLoan(8000e6, 7);
        vm.prank(borrower2);
        vm.expectRevert("LoanVault: insufficient liquidity");
        vault.requestLoan(8000e6, 7);
    }
    function test_Vault_repay_notActiveReverts() public {
        vm.prank(user);
        uint256 id = vault.requestLoan(10e6, 7);
        ILoanVault.Loan memory loan = vault.getLoan(id);
        vm.startPrank(user);
        usdc.approve(address(vault), loan.principal + loan.interest);
        vault.repay(id);
        vm.stopPrank();
        vm.prank(user);
        vm.expectRevert("LoanVault: not active");
        vault.repay(id);
    }
    function test_Vault_repay_notBorrowerReverts() public {
        vm.prank(user);
        uint256 id = vault.requestLoan(10e6, 7);
        vm.prank(lender);
        vm.expectRevert("LoanVault: not borrower");
        vault.repay(id);
    }
    function test_Vault_markDefault_unauthorizedReverts() public {
        vm.prank(user);
        uint256 id = vault.requestLoan(10e6, 7);
        vm.prank(user);
        vm.expectRevert("LoanVault: unauthorized scheduler");
        vault.markDefault(id);
    }
    function test_Vault_markDefault_notActiveReverts() public {
        address sched = vault.repaymentScheduler();
        vm.prank(user);
        uint256 id = vault.requestLoan(10e6, 7);
        // repay first
        ILoanVault.Loan memory loan = vault.getLoan(id);
        vm.startPrank(user);
        usdc.approve(address(vault), loan.principal + loan.interest);
        vault.repay(id);
        vm.stopPrank();
        vm.warp(block.timestamp + 100 days);
        vm.prank(sched);
        vm.expectRevert("LoanVault: not active");
        vault.markDefault(id);
    }
    function test_Vault_markDefault_gracePeriodReverts() public {
        address sched = vault.repaymentScheduler();
        vm.prank(user);
        uint256 id = vault.requestLoan(10e6, 7);
        vm.prank(sched);
        vm.expectRevert("LoanVault: grace period");
        vault.markDefault(id);
    }
    function test_Vault_setters_onlyOwner() public {
        vm.prank(user);
        vm.expectRevert();
        vault.setRepaymentScheduler(address(0x10));
        vm.prank(user);
        vm.expectRevert();
        vault.setCreditLine(address(0x10));
    }
    function test_Vault_getLoan() public {
        vm.prank(user);
        uint256 id = vault.requestLoan(10e6, 7);
        ILoanVault.Loan memory loan = vault.getLoan(id);
        assertEq(loan.principal, 10e6);
    }
    function test_Vault_claimYield() public {
        vm.prank(user);
        vault.claimYield(); // should not revert, emits YieldClaimed
    }

    // ScoreOracle branches
    function test_Oracle_requestScoreUpdate_idempotent() public {
        vm.prank(user);
        oracle.requestScoreUpdate(user); // already has profile, should not revert
        vm.prank(address(0x7));
        oracle.requestScoreUpdate(address(0x7)); // new user
        // second call same user again
        vm.prank(user);
        oracle.requestScoreUpdate(user);
    }
    function test_Oracle_fulfill_invalidScoresReverts() public {
        vm.prank(oracleEOA);
        vm.expectRevert("ScoreOracle: invalid KYC score");
        oracle.fulfillScoreUpdate(user, 1001, 0, 0, 0, 0, false);
        vm.prank(oracleEOA);
        vm.expectRevert("ScoreOracle: invalid rep score");
        oracle.fulfillScoreUpdate(user, 0, 1001, 0, 0, 0, false);
    }
    function test_Oracle_fulfill_onlyTrustedReverts() public {
        vm.prank(user);
        vm.expectRevert("ScoreOracle: not trusted backend");
        oracle.fulfillScoreUpdate(user, 0,0,0,0,0,false);
    }
    function test_Oracle_setters_onlyOwner() public {
        vm.prank(user);
        vm.expectRevert();
        oracle.setTrustedBackend(address(0x10));
        vm.prank(user);
        vm.expectRevert();
        oracle.setScoreRegistry(address(0x10));
    }

    // TranchManager branches
    function test_TM_deposit_invalidTrancheReverts() public {
        vm.startPrank(lender);
        usdc.approve(address(tm), 10e6);
        vm.expectRevert("TranchManager: invalid tranche");
        tm.deposit(lender, 10e6, 2);
        vm.stopPrank();
    }
    function test_TM_withdraw_invalidTrancheReverts() public {
        vm.prank(lender);
        vm.expectRevert("TranchManager: invalid tranche");
        tm.withdraw(lender, 10e6, 2);
    }
    function test_TM_withdraw_insufficientSharesReverts() public {
        vm.prank(lender);
        vm.expectRevert("TranchManager: insufficient shares");
        tm.withdraw(lender, 10e6, 0);
        // also junior
        vm.prank(lender);
        vm.expectRevert("TranchManager: insufficient shares");
        tm.withdraw(lender, 10e6, 1);
    }
    function test_TM_withdraw_junior() public {
        vm.startPrank(lender);
        usdc.approve(address(tm), 20e6);
        tm.deposit(lender, 20e6, 1);
        tm.withdraw(lender, 5e6, 1);
        vm.stopPrank();
        assertEq(tm.getShares(lender, 1), 15e6);
    }
    function test_TM_distributeYield_zeroShares() public {
        vm.prank(owner);
        tm.distributeYield(100e6); // no shares, should not revert
    }
    function test_TM_absorbLoss_zero() public {
        // need junior shares first
        vm.startPrank(lender);
        usdc.approve(address(tm), 20e6);
        tm.deposit(lender, 20e6, 1);
        vm.stopPrank();
        vm.prank(owner);
        tm.absorbLoss(0); // zero loss should succeed
        assertEq(tm.getTotalShares(1), 20e6);
    }
    function test_TM_getShares() public view {
        assertEq(tm.getShares(lender, 0), 0);
        assertEq(tm.getTotalShares(0), 0);
    }
    function test_TM_onlyOwner() public {
        vm.prank(user);
        vm.expectRevert();
        tm.distributeYield(10e6);
        vm.prank(user);
        vm.expectRevert();
        tm.absorbLoss(10e6);
    }

    // RepaymentScheduler branches
    function test_Scheduler_checkNotActiveReverts() public {
        // create a loan, repay it, then try to mark default (should be not active)
        vm.prank(user);
        uint256 id = vault.requestLoan(10e6, 7);
        ILoanVault.Loan memory loan = vault.getLoan(id);
        vm.startPrank(user);
        usdc.approve(address(vault), loan.principal + loan.interest);
        vault.repay(id);
        vm.stopPrank();
        vm.expectRevert("Scheduler: not active");
        scheduler.checkAndMarkDefault(id);
    }
    function test_Scheduler_setters_onlyOwner() public {
        vm.prank(user);
        vm.expectRevert();
        scheduler.setLoanVault(address(0x10));
        vm.prank(user);
        vm.expectRevert();
        scheduler.setScoreRegistry(address(0x10));
    }
}
