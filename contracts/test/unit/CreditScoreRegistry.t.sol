// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../../src/CreditScoreRegistry.sol";
import "../../src/libraries/CreditMath.sol";

contract CreditScoreRegistryTest is Test {
    CreditScoreRegistry registry;
    address owner = address(0x1);
    address oracle = address(0x2);
    address user = address(0x3);

    function setUp() public {
        CreditScoreRegistry impl = new CreditScoreRegistry();
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), abi.encodeCall(CreditScoreRegistry.initialize, (owner)));
        registry = CreditScoreRegistry(address(proxy));
        vm.prank(owner);
        registry.setOracle(oracle, true);
    }

    function test_initProfile_createsZeroedProfile() public {
        vm.prank(oracle);
        registry.initProfile(user);
        ICreditScoreRegistry.CreditProfile memory p = registry.getProfile(user);
        assertEq(p.score, 0);
        assertEq(p.lastUpdated, uint32(block.timestamp));
        assertEq(p.arcPassVerified, false);
        assertEq(registry.getScore(user), 0);
    }

    function test_initProfile_revertsIfExists() public {
        vm.prank(oracle);
        registry.initProfile(user);
        vm.prank(oracle);
        vm.expectRevert("CreditScore: profile exists");
        registry.initProfile(user);
    }

    function test_setScore_updatesScore() public {
        vm.prank(oracle);
        registry.initProfile(user);
        vm.prank(oracle);
        registry.setScore(user, 750, true);
        assertEq(registry.getScore(user), 750);
        ICreditScoreRegistry.CreditProfile memory p = registry.getProfile(user);
        assertTrue(p.arcPassVerified);
    }

    function test_slashScore_clampsAtZero() public {
        vm.prank(oracle);
        registry.initProfile(user);
        vm.prank(oracle);
        registry.setScore(user, 100, false);
        vm.prank(oracle);
        registry.slashScore(user, 150);
        assertEq(registry.getScore(user), 0);
        // again slash at 0 stays 0
        vm.prank(oracle);
        registry.slashScore(user, 500);
        assertEq(registry.getScore(user), 0);
    }

    function test_slashScore_neverUnderflows() public {
        vm.prank(oracle);
        registry.initProfile(user);
        vm.prank(oracle);
        registry.setScore(user, 500, false);
        vm.prank(oracle);
        registry.slashScore(user, 300);
        assertEq(registry.getScore(user), 200);
    }

    function test_slashScore_unauthorizedReverts() public {
        vm.prank(oracle);
        registry.initProfile(user);
        vm.prank(user);
        vm.expectRevert("CreditScore: unauthorized oracle");
        registry.slashScore(user, 100);
    }

    function test_updateScore_onlyOracle() public {
        vm.prank(user);
        vm.expectRevert("CreditScore: unauthorized oracle");
        registry.updateScore(user);
        // oracle can call
        vm.prank(oracle);
        registry.updateScore(user);
        // lastUpdated updated
        ICreditScoreRegistry.CreditProfile memory p = registry.getProfile(user);
        assertEq(p.lastUpdated, uint32(block.timestamp));
    }

    function testFuzz_scoreAlwaysClamped(uint16 kycRaw, uint16 repRaw, uint32 repayRaw, uint96 volRaw, uint32 ageRaw) public pure {
        uint16 s = CreditMath.computeScore(kycRaw, repRaw, repayRaw, volRaw, ageRaw);
        assertLe(s, 1000);
    }
}
