// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SpendVault} from "../src/SpendVault.sol";

/// Test için sahte USDC (6 decimal).
contract MockUSDC {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract SpendVaultTest is Test {
    MockUSDC usdc;
    SpendVault vault;
    address agent = address(0xA9E17);
    address merchant = address(0xBEEF);
    address stranger = address(0xBAD);

    uint256 constant MAX_PER_TX = 5e6; // 5 USDC
    uint256 constant DAILY = 20e6;     // 20 USDC

    function setUp() public {
        usdc = new MockUSDC();
        vault = new SpendVault(address(usdc), agent, MAX_PER_TX, DAILY);
        vault.setAllowlist(merchant, true);
        usdc.mint(address(vault), 100e6); // kasaya 100 USDC
    }

    function test_NormalSpendPasses() public {
        vm.prank(agent);
        vault.spend(merchant, 3e6);
        assertEq(usdc.balanceOf(merchant), 3e6);
        assertEq(vault.spentLast24h(), 3e6);
    }

    function test_RevertWhen_NotAgent() public {
        vm.prank(stranger);
        vm.expectRevert(SpendVault.NotAgent.selector);
        vault.spend(merchant, 1e6);
    }

    function test_RevertWhen_NotAllowlisted() public {
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SpendVault.NotAllowlisted.selector, stranger));
        vault.spend(stranger, 1e6);
    }

    function test_RevertWhen_ExceedsPerTxLimit() public {
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SpendVault.ExceedsPerTxLimit.selector, 6e6, MAX_PER_TX));
        vault.spend(merchant, 6e6);
    }

    function test_RevertWhen_ExceedsDailyLimit() public {
        // 4 x 5 USDC = 20 USDC → günlük limit dolar
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(agent);
            vault.spend(merchant, 5e6);
        }
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(SpendVault.ExceedsDailyLimit.selector, 21e6, DAILY));
        vault.spend(merchant, 1e6);
    }

    function test_DailyLimitSlides() public {
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(agent);
            vault.spend(merchant, 5e6);
        }
        // 24 saat + 1 saniye sonra pencere boşalır → tekrar harcanabilir
        vm.warp(block.timestamp + 24 hours + 1);
        assertEq(vault.spentLast24h(), 0);
        vm.prank(agent);
        vault.spend(merchant, 5e6);
    }

    function test_PauseBlocksEverything_AgentCanTrigger() public {
        vm.prank(agent); // risk beyni ajan anahtarıyla acil durdurma çekebilir
        vault.pause();
        vm.prank(agent);
        vm.expectRevert(SpendVault.VaultPaused.selector);
        vault.spend(merchant, 1e6);
        // sadece owner geri açar
        vm.prank(agent);
        vm.expectRevert(SpendVault.NotOwner.selector);
        vault.unpause();
        vault.unpause(); // owner (bu test kontratı)
        vm.prank(agent);
        vault.spend(merchant, 1e6);
    }

    function test_OwnerCanWithdraw() public {
        vault.withdraw(address(this), 100e6);
        assertEq(usdc.balanceOf(address(this)), 100e6);
    }
}
