// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockDexPair {
    address public token0;
    address public token1;
    uint112 private reserve0;
    uint112 private reserve1;

    constructor(address firstToken, address secondToken, uint112 firstReserve, uint112 secondReserve) {
        token0 = firstToken;
        token1 = secondToken;
        reserve0 = firstReserve;
        reserve1 = secondReserve;
    }

    function setReserves(uint112 firstReserve, uint112 secondReserve) external {
        reserve0 = firstReserve;
        reserve1 = secondReserve;
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, uint32(block.timestamp));
    }
}
