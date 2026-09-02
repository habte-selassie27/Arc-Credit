// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/ICreditScoreRegistry.sol";
import "./libraries/CreditMath.sol";

contract CreditScoreRegistry is ICreditScoreRegistry, OwnableUpgradeable, UUPSUpgradeable {
    struct CreditProfileInternal {
        uint16  score;
        uint32  lastUpdated;
        uint32  totalLoans;
        uint32  repaidLoans;
        uint32  defaultedLoans;
        uint96  totalVolumeUSDC;
        bool    arcPassVerified;
    }

    mapping(address => CreditProfileInternal) internal _profiles;
    mapping(address => bool) public authorizedOracles;

    uint32 public constant MIN_UPDATE_INTERVAL = 1 hours;

    function initialize(address owner) external initializer {
        __Ownable_init(owner);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    modifier onlyAuthorizedOracle() {
        require(authorizedOracles[msg.sender], "CreditScore: unauthorized oracle");
        _;
    }

    function getScore(address borrower) external view override returns (uint16) {
        return _profiles[borrower].score;
    }

    function getProfile(address borrower) external view override returns (CreditProfile memory) {
        CreditProfileInternal storage p = _profiles[borrower];
        return CreditProfile({
            score: p.score,
            lastUpdated: p.lastUpdated,
            totalLoans: p.totalLoans,
            repaidLoans: p.repaidLoans,
            defaultedLoans: p.defaultedLoans,
            totalVolumeUSDC: p.totalVolumeUSDC,
            arcPassVerified: p.arcPassVerified
        });
    }

    function initProfile(address borrower) external override {
        require(_profiles[borrower].lastUpdated == 0, "CreditScore: profile exists");
        _profiles[borrower].lastUpdated = uint32(block.timestamp);
        emit ProfileInitialized(borrower);
    }

    function updateScore(address borrower) external override onlyAuthorizedOracle {
        _profiles[borrower].lastUpdated = uint32(block.timestamp);
    }

    function setScore(address borrower, uint16 newScore, bool arcPassVerified) external onlyAuthorizedOracle {
        _profiles[borrower].score = newScore;
        _profiles[borrower].arcPassVerified = arcPassVerified;
        _profiles[borrower].lastUpdated = uint32(block.timestamp);
        emit ScoreSet(borrower, newScore, arcPassVerified);
    }

    function slashScore(address borrower, uint16 penalty) external override onlyAuthorizedOracle {
        CreditProfileInternal storage p = _profiles[borrower];
        if (p.score <= penalty) {
            p.score = 0;
        } else {
            p.score -= penalty;
        }
        p.lastUpdated = uint32(block.timestamp);
        emit ScoreSlashed(borrower, penalty, p.score);
    }

    function incrementLoans(address borrower) external onlyAuthorizedOracle {
        _profiles[borrower].totalLoans++;
    }

    function incrementRepaid(address borrower, uint96 volumeUSDC) external onlyAuthorizedOracle {
        CreditProfileInternal storage p = _profiles[borrower];
        p.repaidLoans++;
        p.totalVolumeUSDC += volumeUSDC;
    }

    function incrementDefaulted(address borrower) external onlyAuthorizedOracle {
        _profiles[borrower].defaultedLoans++;
    }

    function setOracle(address oracle, bool authorized) external onlyOwner {
        require(oracle != address(0), "CreditScore: zero address");
        authorizedOracles[oracle] = authorized;
        emit OracleAuthorized(oracle, authorized);
    }

    event OracleAuthorized(address indexed oracle, bool authorized);
    event ScoreSet(address indexed borrower, uint16 score, bool arcPassVerified);
    event ScoreSlashed(address indexed borrower, uint16 penalty, uint16 newScore);
    event ProfileInitialized(address indexed borrower);
}
