// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/CreditScoreRegistry.sol";
import "../src/ScoreOracle.sol";
import "../src/CreditLine.sol";
import "../src/TranchManager.sol";
import "../src/LoanVault.sol";
import "../src/RepaymentScheduler.sol";

interface Vm {
    function addr(uint256 privateKey) external pure returns (address);
    function envUint(string calldata name) external view returns (uint256);
    function startBroadcast() external;
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

address constant USDC_ADDRESS = 0x1000000000000000000000000000000000000001;

contract DeployScript {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // Deploy implementations + proxies (UUPS pattern — matches ArcPass)
        CreditScoreRegistry scoreRegImpl = new CreditScoreRegistry();
        ERC1967Proxy scoreRegProxy = new ERC1967Proxy(address(scoreRegImpl), abi.encodeCall(CreditScoreRegistry.initialize, (deployer)));
        CreditScoreRegistry scoreRegistry = CreditScoreRegistry(address(scoreRegProxy));

        ScoreOracle scoreOracleImpl = new ScoreOracle();
        ERC1967Proxy oracleProxy = new ERC1967Proxy(address(scoreOracleImpl), abi.encodeCall(ScoreOracle.initialize, (deployer, address(scoreRegistry))));
        ScoreOracle scoreOracle = ScoreOracle(address(oracleProxy));

        CreditLine creditLineImpl = new CreditLine();
        ERC1967Proxy creditLineProxy = new ERC1967Proxy(address(creditLineImpl), abi.encodeCall(CreditLine.initialize, (deployer, address(scoreRegistry))));
        CreditLine creditLine = CreditLine(address(creditLineProxy));

        TranchManager tranchImpl = new TranchManager();
        ERC1967Proxy tranchProxy = new ERC1967Proxy(address(tranchImpl), abi.encodeCall(TranchManager.initialize, (deployer, USDC_ADDRESS)));
        TranchManager tranchManager = TranchManager(address(tranchProxy));

        LoanVault vaultImpl = new LoanVault();
        ERC1967Proxy vaultProxy = new ERC1967Proxy(address(vaultImpl), abi.encodeCall(LoanVault.initialize, (deployer, USDC_ADDRESS, address(creditLine))));
        LoanVault loanVault = LoanVault(address(vaultProxy));

        RepaymentScheduler schedImpl = new RepaymentScheduler();
        ERC1967Proxy schedProxy = new ERC1967Proxy(address(schedImpl), abi.encodeCall(RepaymentScheduler.initialize, (deployer, address(loanVault), address(scoreRegistry))));
        RepaymentScheduler scheduler = RepaymentScheduler(address(schedProxy));

        // Wire permissions (spec §10 step 8)
        scoreRegistry.setOracle(address(scoreOracle), true);
        scoreOracle.setTrustedBackend(deployer);
        creditLine.setVault(address(loanVault), true);
        loanVault.setRepaymentScheduler(address(scheduler));
        // RepaymentScheduler authorized as oracle for slashing
        scoreRegistry.setOracle(address(scheduler), true);

        vm.stopBroadcast();
    }
}
