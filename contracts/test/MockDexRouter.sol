// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./MockERC20.sol";

contract MockDexRouter {
    address public factory;
    uint256 public outputMultiplier = 2;

    constructor(address factoryAddress) {
        factory = factoryAddress;
    }

    function setOutputMultiplier(uint256 multiplier) external {
        outputMultiplier = multiplier;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        MockERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);

        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        for (uint256 index = 1; index < path.length; index += 1) {
            amounts[index] = amounts[index - 1] * outputMultiplier;
        }

        require(amounts[path.length - 1] >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");
        MockERC20(path[path.length - 1]).mint(to, amounts[path.length - 1]);
    }
}
