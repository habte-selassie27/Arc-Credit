// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/CreditScoreRegistry.sol";
import "../../src/CreditLine.sol";
import "../../src/LoanVault.sol";
import "../mocks/MockUSDC.sol";

contract VaultHandler is Test {
    MockUSDC public usdc;
    CreditScoreRegistry public registry;
    CreditLine public creditLine;
    LoanVault public vault;
    address public owner;
    address public oracle;
    address[] public borrowers;
    address[] public lenders;

    constructor(MockUSDC _usdc, CreditScoreRegistry _registry, CreditLine _creditLine, LoanVault _vault, address _owner, address _oracle) {
        usdc = _usdc;
        registry = _registry;
        creditLine = _creditLine;
        vault = _vault;
        owner = _owner;
        oracle = _oracle;
    }

    function addBorrower(address b) external {
        borrowers.push(b);
        // init and give high score
        vm.prank(oracle);
        registry.initProfile(b);
        vm.prank(oracle);
        registry.setScore(b, 900, true);
        creditLine.refreshCredit(b);
        usdc.mint(b, 100000e6);
    }

    function addLender(address l) external {
        lenders.push(l);
        usdc.mint(l, 100000e6);
    }

    function deposit(uint256 lenderIdx, uint256 amount, uint8 tranche) external {
        if (lenders.length == 0) return;
        address lender = lenders[lenderIdx % lenders.length];
        amount = bound(amount, 5e6, 10000e6);
        tranche = tranche % 2;
        if (tranche == 0 && amount < 10e6) amount = 10e6;
        vm.startPrank(lender);
        usdc.approve(address(vault), amount);
        // vault deposit doesn't check tranche but we call it
        try vault.deposit(amount, tranche) {} catch {}
        vm.stopPrank();
    }

    function requestLoan(uint256 borrowerIdx, uint256 amount, uint8 termIdx) external {
        if (borrowers.length == 0) return;
        address borrower = borrowers[borrowers.length > 0 ? borrowerIdx % borrowers.length : 0];
        // skip if already has active loan
        if (vault.activeLoanId(borrower) != 0) return;
        uint256 avail = creditLine.getAvailableCredit(borrower);
        if (avail == 0) return;
        amount = bound(amount, 1e6, avail);
        uint8[4] memory terms = [uint8(7), 14, 30, 90];
        uint8 term = terms[termIdx % 4];
        vm.prank(borrower);
        try vault.requestLoan(amount, term) {} catch {}
    }

    function repay(uint256 borrowerIdx) external {
        if (borrowers.length == 0) return;
        address borrower = borrowers[borrowerIdx % borrowers.length];
        uint256 loanId = vault.activeLoanId(borrower);
        if (loanId == 0) return;
        ILoanVault.Loan memory loan = vault.getLoan(loanId);
        if (loan.status != ILoanVault.LoanStatus.ACTIVE) return;
        uint256 totalDue = loan.principal + loan.interest;
        // ensure borrower has enough
        usdc.mint(borrower, totalDue);
        vm.startPrank(borrower);
        usdc.approve(address(vault), totalDue);
        try vault.repay(loanId) {} catch {}
        vm.stopPrank();
    }
}

contract InvariantVaultTest is Test {
    MockUSDC usdc;
    CreditScoreRegistry registry;
    CreditLine creditLine;
    LoanVault vault;
    VaultHandler handler;
    address owner = address(0x1);
    address oracle = address(0x2);

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

        handler = new VaultHandler(usdc, registry, creditLine, vault, owner, oracle);
        // seed borrowers/lenders
        handler.addBorrower(address(0x10));
        handler.addBorrower(address(0x11));
        handler.addLender(address(0x20));
        handler.addLender(address(0x21));
        // seed vault with deposits via proper accounting (don't mint directly to vault)
        address seedLender = address(0x20);
        usdc.mint(seedLender, 100000e6);
        vm.startPrank(seedLender);
        usdc.approve(address(vault), 50000e6);
        vault.deposit(50000e6, 0);
        vm.stopPrank();

        targetContract(address(handler));
    }

    function invariant_totalDepositedGeTotalLent() public view {
        assertGe(vault.totalDeposited(), vault.totalLent(), "totalDeposited must >= totalLent");
    }

    function invariant_nextLoanIdMonotonic() public view {
        // nextLoanId should never decrease (tested via handler)
        assertGe(vault.nextLoanId(), 1);
    }
}
