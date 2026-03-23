// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/Web3CXIVToken.sol";

contract Web3CXIVTokenTest is Test {
    Web3CXIVToken public token;
    address public owner;
    address public user1;
    address public user2;

    uint256 public constant FAUCET_AMOUNT = 100 * 10**18;
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10**18;

    function setUp() public {
        vm.warp(1704067200);

        owner = address(this);
        user1 = address(0x1);
        user2 = address(0x2);

        token = new Web3CXIVToken();

        token.mint(user1, 1000 * 10**18);
        token.mint(user2, 500 * 10**18);
    }

    function test_InitialState() public view {
        assertEq(token.name(), "WEB3CXIV");
        assertEq(token.symbol(), "CXIV");
        assertEq(token.decimals(), 18);
        assertEq(token.MAX_SUPPLY(), MAX_SUPPLY);
        assertEq(token.owner(), owner);
        assertEq(token.totalSupply(), 1500 * 10**18);
    }

    function test_Mint() public {
        vm.prank(owner);
        token.mint(user1, 500 * 10**18);

        assertEq(token.balanceOf(user1), 1500 * 10**18);
        assertEq(token.totalSupply(), 2000 * 10**18);
    }

    function test_MintExceedsMaxSupply() public {
        vm.prank(owner);
        vm.expectRevert("Exceeds max supply");
        token.mint(user1, MAX_SUPPLY);
    }

    function test_OnlyOwnerCanMint() public {
        vm.prank(user1);
        vm.expectRevert("Only owner");
        token.mint(user2, 100 * 10**18);
    }

    function test_RequestTokens() public {
        vm.startPrank(user1, user1);
        token.requestTokens();
        vm.stopPrank();

        assertEq(token.balanceOf(user1), 1100 * 10**18);
        assertEq(token.totalSupply(), 1600 * 10**18);
        assertEq(token.lastRequestTime(user1), block.timestamp);
    }

    function test_RequestTokensWithCooldown() public {
        vm.startPrank(user1, user1);
        token.requestTokens();
        vm.stopPrank();

        vm.warp(block.timestamp + 12 hours);

        vm.startPrank(user1, user1);
        vm.expectRevert("Cooldown active");
        token.requestTokens();
        vm.stopPrank();
    }

    function test_RequestTokensAfterCooldown() public {
        vm.startPrank(user1, user1);
        token.requestTokens();
        vm.stopPrank();

        vm.warp(block.timestamp + 25 hours);

        vm.startPrank(user1, user1);
        token.requestTokens();
        vm.stopPrank();

        assertEq(token.balanceOf(user1), 1200 * 10**18);
    }

    function test_GetRemainingCooldown() public {
        vm.startPrank(user1, user1);
        token.requestTokens();
        vm.stopPrank();

        vm.warp(block.timestamp + 12 hours);

        uint256 remaining = token.getRemainingCooldown(user1);
        assertEq(remaining, 12 hours);

        vm.warp(block.timestamp + 13 hours);
        remaining = token.getRemainingCooldown(user1);
        assertEq(remaining, 0);
    }

    function test_Transfer() public {
        vm.prank(user1);
        token.transfer(user2, 200 * 10**18);

        assertEq(token.balanceOf(user1), 800 * 10**18);
        assertEq(token.balanceOf(user2), 700 * 10**18);
    }

    function test_TransferInsufficientBalance() public {
        vm.prank(user2);
        vm.expectRevert("Insufficient balance");
        token.transfer(user1, 1000 * 10**18);
    }

    function test_Approve() public {
        vm.prank(user1);
        token.approve(user2, 300 * 10**18);

        assertEq(token.allowance(user1, user2), 300 * 10**18);
    }

    function test_TransferFrom() public {
        vm.prank(user1);
        token.approve(user2, 300 * 10**18);

        vm.prank(user2);
        token.transferFrom(user1, user2, 200 * 10**18);

        assertEq(token.balanceOf(user1), 800 * 10**18);
        assertEq(token.balanceOf(user2), 700 * 10**18);
        assertEq(token.allowance(user1, user2), 100 * 10**18);
    }

    function test_TransferFromInsufficientAllowance() public {
        vm.prank(user1);
        token.approve(user2, 100 * 10**18);

        vm.prank(user2);
        vm.expectRevert("Insufficient allowance");
        token.transferFrom(user1, user2, 200 * 10**18);
    }
}

