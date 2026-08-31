// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/ICreditScoreRegistry.sol";
import "./libraries/CreditMath.sol";

contract ScoreOracle is OwnableUpgradeable {
    ICreditScoreRegistry public scoreRegistry;

    address public trustedBackend;

    uint256 public constant KYC_SCHEMA = 0x72632e6b79632e76310000000000000000000000000000000000000000000000;
    uint256 public constant REP_SCHEMA = 0x72632e72657075746174696f6e2e763100000000000000000000000000000000;

    uint32 public constant KYC_VALIDITY = 365 days;
    uint32 public constant REP_VALIDITY = 30 days;

    function initialize(address owner, address _scoreRegistry) external initializer {
        __Ownable_init(owner);
        scoreRegistry = ICreditScoreRegistry(_scoreRegistry);
    }

    modifier onlyTrustedBackend() {
        require(msg.sender == trustedBackend, "ScoreOracle: not trusted backend");
        _;
    }

    function requestScoreUpdate(address borrower) external {
        scoreRegistry.initProfile(borrower);
        emit ScoreUpdateRequested(borrower);
    }

    function fulfillScoreUpdate(
        address borrower,
        uint16 arcPassKycScore,
        uint16 arcPassRepScore,
        uint32 repaymentRaw,
        uint96 usdcThroughput90d,
        uint32 walletAgeDays,
        bool arcPassVerified
    ) external onlyTrustedBackend {
        require(arcPassKycScore <= 1000, "ScoreOracle: invalid KYC score");
        require(arcPassRepScore <= 1000, "ScoreOracle: invalid rep score");

        uint16 finalScore = CreditMath.computeScore(
            arcPassKycScore,
            arcPassRepScore,
            repaymentRaw,
            usdcThroughput90d,
            walletAgeDays
        );

        scoreRegistry.setScore(borrower, finalScore, arcPassVerified);

        emit ScoreUpdateCompleted(borrower, finalScore);
    }

    function setTrustedBackend(address _trustedBackend) external onlyOwner {
        trustedBackend = _trustedBackend;
    }

    function setScoreRegistry(address _scoreRegistry) external onlyOwner {
        scoreRegistry = ICreditScoreRegistry(_scoreRegistry);
    }

    event ScoreUpdateRequested(address indexed borrower);
    event ScoreUpdateCompleted(address indexed borrower, uint16 newScore);
}
