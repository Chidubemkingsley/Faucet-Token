// script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/Web3CXIVToken.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        Web3CXIVToken token = new Web3CXIVToken();
        
        console.log("Token deployed at:", address(token));
        
        vm.stopBroadcast();
    }
}