// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Web3CXIVToken {
    // =========================
    // TOKEN METADATA
    // =========================
    string public constant name = "WEB3CXIV";
    string public constant symbol = "CXIV";
    uint8 public constant decimals = 18;

    uint256 public constant MAX_SUPPLY = 10_000_000 * 1e18;

    // =========================
    // STATE
    // =========================
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // =========================
    // FAUCET CONFIG
    // =========================
    uint256 public constant FAUCET_AMOUNT = 100 * 1e18;
    uint256 public constant FAUCET_COOLDOWN = 24 hours;

    mapping(address => uint256) public lastRequestTime;

    // =========================
    // OWNERSHIP
    // =========================
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // =========================
    // EVENTS
    // =========================
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event TokensMinted(address indexed to, uint256 amount);
    event TokensRequested(address indexed requester, uint256 amount);

    // =========================
    // INTERNAL MINT
    // =========================
    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "Zero address");
        require(totalSupply + amount <= MAX_SUPPLY, "Exceeds max supply");

        totalSupply += amount;
        balanceOf[to] += amount;

        emit Transfer(address(0), to, amount);
    }

    // =========================
    // OWNER MINT
    // =========================
    function mint(address to, uint256 amount) external onlyOwner {
        require(amount > 0, "Invalid amount");

        _mint(to, amount);

        emit TokensMinted(to, amount);
    }

    // =========================
    // FAUCET (FIXED + SAFE)
    // =========================
    function requestTokens() external {
        // 🔴 1. Cooldown enforcement
        require(
            block.timestamp >= lastRequestTime[msg.sender] + FAUCET_COOLDOWN,
            "Cooldown active"
        );

        // 🔴 2. Global supply protection (FIXED)
        require(
            totalSupply + FAUCET_AMOUNT <= MAX_SUPPLY,
            "Exceeds max supply"
        );

        // 🟡 3. Basic bot protection (optional but useful)
        require(msg.sender == tx.origin, "No contracts");

        // ✅ Update cooldown BEFORE mint
        lastRequestTime[msg.sender] = block.timestamp;

        // ✅ Mint tokens safely
        _mint(msg.sender, FAUCET_AMOUNT);

        emit TokensRequested(msg.sender, FAUCET_AMOUNT);
    }

    // =========================
    // COOLDOWN VIEW
    // =========================
    function getRemainingCooldown(address user) external view returns (uint256) {
        uint256 last = lastRequestTime[user];

        if (block.timestamp >= last + FAUCET_COOLDOWN) {
            return 0;
        }

        return (last + FAUCET_COOLDOWN) - block.timestamp;
    }

    // =========================
    // ERC20 FUNCTIONS
    // =========================
    function transfer(address to, uint256 value) external returns (bool) {
        require(to != address(0), "Zero address");
        require(balanceOf[msg.sender] >= value, "Insufficient balance");

        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;

        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        require(spender != address(0), "Zero address");

        allowance[msg.sender][spender] = value;

        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(to != address(0), "Zero address");
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Insufficient allowance");

        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;

        emit Transfer(from, to, value);
        return true;
    }
}