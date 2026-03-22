// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Web3CXIVToken {
    // Token metadata
    string public constant name = "WEB3CXIV";
    string public constant symbol = "CXIV";
    uint8 public constant decimals = 18;
    uint256 public constant MAX_SUPPLY = 10_000_000 * 10**18; // 10 million tokens
    
    // State variables
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    // Faucet variables
    uint256 public constant FAUCET_AMOUNT = 100 * 10**18; // 100 tokens per request
    uint256 public constant FAUCET_COOLDOWN = 24 hours;
    mapping(address => uint256) public lastRequestTime;
    
    // Ownership
    address public owner;
    
    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event TokensMinted(address indexed to, uint256 amount);
    event TokensRequested(address indexed requester, uint256 amount);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Mint tokens to an address (only owner)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(amount > 0, "Amount must be greater than 0");
        require(totalSupply + amount <= MAX_SUPPLY, "Exceeds max supply");
        
        totalSupply += amount;
        balanceOf[to] += amount;
        
        emit Transfer(address(0), to, amount);
        emit TokensMinted(to, amount);
    }
    
    /**
     * @dev Request tokens from faucet (cooldown: 24 hours)
     */
    function requestTokens() external {
        require(balanceOf[msg.sender] + FAUCET_AMOUNT <= MAX_SUPPLY, "Would exceed max supply");
        require(block.timestamp >= lastRequestTime[msg.sender] + FAUCET_COOLDOWN, "Cooldown period not over");
        
        lastRequestTime[msg.sender] = block.timestamp;
        balanceOf[msg.sender] += FAUCET_AMOUNT;
        totalSupply += FAUCET_AMOUNT;
        
        emit Transfer(address(0), msg.sender, FAUCET_AMOUNT);
        emit TokensRequested(msg.sender, FAUCET_AMOUNT);
    }
    
    /**
     * @dev Get remaining cooldown time for an address
     * @param user Address to check cooldown for
     * @return remaining time in seconds
     */
    function getRemainingCooldown(address user) external view returns (uint256) {
        if (lastRequestTime[user] == 0) return 0;
        uint256 nextRequestTime = lastRequestTime[user] + FAUCET_COOLDOWN;
        if (block.timestamp >= nextRequestTime) return 0;
        return nextRequestTime - block.timestamp;
    }
    
    /**
     * @dev Transfer tokens
     * @param to Recipient address
     * @param value Amount to transfer
     */
    function transfer(address to, uint256 value) external returns (bool) {
        require(to != address(0), "Cannot transfer to zero address");
        require(value > 0, "Amount must be greater than 0");
        require(balanceOf[msg.sender] >= value, "Insufficient balance");
        
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        
        emit Transfer(msg.sender, to, value);
        return true;
    }
    
    /**
     * @dev Transfer from one address to another (with allowance)
     * @param from Sender address
     * @param to Recipient address
     * @param value Amount to transfer
     */
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(to != address(0), "Cannot transfer to zero address");
        require(value > 0, "Amount must be greater than 0");
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Insufficient allowance");
        
        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;
        
        emit Transfer(from, to, value);
        return true;
    }
    
    /**
     * @dev Approve spender to spend tokens
     * @param spender Address to approve
     * @param value Amount to approve
     */
    function approve(address spender, uint256 value) external returns (bool) {
        require(spender != address(0), "Cannot approve zero address");
        
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }
}