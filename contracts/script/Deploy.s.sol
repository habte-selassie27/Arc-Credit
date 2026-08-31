# SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/CreditScoreRegistry.sol";
import "../src/ScoreOracle.sol";
import "../src/CreditLine.sol";
import "../src/TranchManager.sol";
import "../src/LoanVault.sol";
import "../src/RepaymentScheduler.sol";

contract Deploy is Script {
    address constant USDC_ADDRESS = 0x1000000000000000000000000000000000000001;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        CreditScoreRegistry scoreRegistry = new CreditScoreRegistry();
        scoreRegistry.initialize(deployer);

        ScoreOracle scoreOracle = new ScoreOracle();
        scoreOracle.initialize(deployer, address(scoreRegistry));

        CreditLine creditLine = new CreditLine();
        creditLine.initialize(deployer, address(scoreRegistry));

        TranchManager tranchManager = new TranchManager();
        tranchManager.initialize(deployer, USDC_ADDRESS);

        LoanVault loanVault = new LoanVault();
        loanVault.initialize(deployer, USDC_ADDRESS, address(creditLine));

        RepaymentScheduler scheduler = new RepaymentScheduler();
        scheduler.initialize(deployer, address(loanVault), address(scoreRegistry));

        scoreRegistry.setOracle(address(scoreOracle), true);
        creditLine.setVault(address(loanVault), true);
        loanVault.setRepaymentScheduler(address(scheduler));

        vm.stopBroadcast();

        console.log("CreditScoreRegistry:", address(scoreRegistry));
        console.log("ScoreOracle:", address(scoreOracle));
        console.log("CreditLine:", address(creditLine));
        console.log("TranchManager:", address(tranchManager));
        console.log("LoanVault:", address(loanVault));
        console.log("RepaymentScheduler:", address(scheduler));
    }
}
