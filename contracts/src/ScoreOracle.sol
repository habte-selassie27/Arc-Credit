// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/ICreditScoreRegistry.sol";
import "./libraries/CreditMath.sol";

contract ScoreOracle is OwnableUpgradeable, UUPSUpgradeable {
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

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    modifier onlyTrustedBackend() {
        require(msg.sender == trustedBackend, "ScoreOracle: not trusted backend");
        _;
    }

    function requestScoreUpdate(address borrower) external {
        // init only if profile doesn't exist (lastUpdated == 0); don't revert on re-request
        try scoreRegistry.initProfile(borrower) {} catch {}
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
        require(repaymentRaw <= 1000, "ScoreOracle: invalid repayment score");
        require(usdcThroughput90d <= 1000, "ScoreOracle: invalid throughput score");
        require(walletAgeDays <= 1000, "ScoreOracle: invalid wallet age");

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
        require(_trustedBackend != address(0), "ScoreOracle: zero address");
        trustedBackend = _trustedBackend;
        emit TrustedBackendUpdated(_trustedBackend);
    }

    function setScoreRegistry(address _scoreRegistry) external onlyOwner {
        require(_scoreRegistry != address(0), "ScoreOracle: zero address");
        scoreRegistry = ICreditScoreRegistry(_scoreRegistry);
        emit ScoreRegistryUpdated(_scoreRegistry);
    }

    event ScoreUpdateRequested(address indexed borrower);
    event ScoreUpdateCompleted(address indexed borrower, uint16 newScore);
    event TrustedBackendUpdated(address indexed trustedBackend);
    event ScoreRegistryUpdated(address indexed scoreRegistry);
}
