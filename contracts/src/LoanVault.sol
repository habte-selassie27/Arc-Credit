// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./interfaces/ICreditLine.sol";
import "./interfaces/ILoanVault.sol";
import "./libraries/InterestLib.sol";

contract LoanVault is ILoanVault, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    IERC20Upgradeable public usdc;
    ICreditLine public creditLine;

    mapping(uint256 => Loan) public loans;
    mapping(address => uint256) public activeLoanId;
    uint256 public nextLoanId;
    uint256 public totalDeposited;
    uint256 public totalLent;

    address public repaymentScheduler;

    uint256 public constant GRACE_PERIOD = 48 hours;

    function initialize(
        address owner,
        address _usdc,
        address _creditLine
    ) external initializer {
        __Ownable_init(owner);
        __ReentrancyGuard_init();
        usdc = IERC20Upgradeable(_usdc);
        creditLine = ICreditLine(_creditLine);
    }

    function deposit(uint256 amount, uint8 tranche) external override nonReentrant {
        require(amount > 0, "LoanVault: zero deposit");
        usdc.transferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
    }

    function withdraw(uint256 shares, uint8 tranche) external override nonReentrant {
        require(shares > 0, "LoanVault: zero shares");
        require(totalDeposited >= totalLent + shares, "LoanVault: insufficient liquidity");
        usdc.transfer(msg.sender, shares);
        totalDeposited -= shares;
    }

    function requestLoan(uint256 amount, uint8 termDays) external override nonReentrant returns (uint256 loanId) {
        require(amount > 0, "LoanVault: zero amount");
        require(
            termDays == 7 || termDays == 14 || termDays == 30 || termDays == 90,
            "LoanVault: invalid term"
        );

        loanId = nextLoanId++;

        uint256 creditAvail = creditLine.getAvailableCredit(msg.sender);
        require(creditAvail >= amount, "LoanVault: insufficient credit");

        creditLine.lockCredit(msg.sender, amount);

        uint256 apr = creditLine.getInterestRate(msg.sender);
        uint256 interest = InterestLib.computeInterest(amount, apr, termDays);
        uint256 dueTimestamp = block.timestamp + (uint256(termDays) * InterestLib.SECONDS_PER_DAY);

        loans[loanId] = Loan({
            borrower: msg.sender,
            principal: amount,
            interest: interest,
            dueTimestamp: dueTimestamp,
            termDays: termDays,
            status: LoanStatus.ACTIVE
        });

        activeLoanId[msg.sender] = loanId;
        totalLent += amount;

        usdc.transfer(msg.sender, amount);

        emit LoanRequested(loanId, msg.sender, amount, termDays);
    }

    function repay(uint256 loanId) external override nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "LoanVault: not active");
        require(loan.borrower == msg.sender, "LoanVault: not borrower");

        uint256 totalDue = InterestLib.computeTotalDue(loan.principal, loan.interest);

        usdc.transferFrom(msg.sender, address(this), totalDue);

        loan.status = LoanStatus.REPAID;
        activeLoanId[msg.sender] = 0;
        totalLent -= loan.principal;

        creditLine.releaseCredit(msg.sender, loan.principal);
        creditLine.setActiveLoan(msg.sender, 0);

        uint256 protocolFee = InterestLib.computeProtocolFee(loan.interest);

        emit LoanRepaid(loanId, msg.sender, totalDue);
    }

    function markDefault(uint256 loanId) external override {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "LoanVault: not active");
        require(block.timestamp > loan.dueTimestamp + GRACE_PERIOD, "LoanVault: grace period");

        loan.status = LoanStatus.DEFAULTED;
        activeLoanId[loan.borrower] = 0;
        totalLent -= loan.principal;

        creditLine.setActiveLoan(loan.borrower, 0);

        emit LoanDefaulted(loanId, loan.borrower, loan.principal);
    }

    function getLoan(uint256 loanId) external view override returns (Loan memory) {
        return loans[loanId];
    }

    function setRepaymentScheduler(address _scheduler) external onlyOwner {
        repaymentScheduler = _scheduler;
    }

    function setCreditLine(address _creditLine) external onlyOwner {
        creditLine = ICreditLine(_creditLine);
    }

    function claimYield() external override {
        revert("LoanVault: yield not yet implemented");
    }

    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, uint8 termDays);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 totalDue);
    event LoanDefaulted(uint256 indexed loanId, address indexed borrower, uint256 principal);
}
