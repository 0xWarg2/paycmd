// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockDexFactory {
    mapping(address tokenA => mapping(address tokenB => address pair)) public getPair;

    function setPair(address tokenA, address tokenB, address pair) external {
        getPair[tokenA][tokenB] = pair;
        getPair[tokenB][tokenA] = pair;
    }
}
