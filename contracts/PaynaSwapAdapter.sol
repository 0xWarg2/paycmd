// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20Minimal {
    function approve(address spender, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

interface IDexFactoryMinimal {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IDexPairMinimal {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

interface IDexRouterMinimal {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

contract PaynaSwapAdapter {
    address public owner;
    address public dexRouter;
    address public dexFactory;
    address public immutable usdc;
    address public immutable eurc;
    address public immutable cirbtc;
    mapping(address token => bool allowed) public allowedTokens;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event DexRouterUpdated(address indexed previousRouter, address indexed newRouter);
    event DexFactoryUpdated(address indexed previousFactory, address indexed newFactory);
    event PaynaSwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient,
        address router
    );

    error NotOwner();
    error ZeroAddress();
    error InvalidToken();
    error SameToken();
    error InvalidAmount();
    error ExpiredDeadline();
    error PairNotFound(address tokenA, address tokenB);
    error EmptyLiquidity(address pair);
    error SwapOutputTooLow();
    error SafeTransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        address initialRouter,
        address initialFactory,
        address usdcToken,
        address eurcToken,
        address cirbtcToken,
        address initialOwner
    ) {
        if (
            initialRouter == address(0) ||
            initialFactory == address(0) ||
            usdcToken == address(0) ||
            eurcToken == address(0) ||
            cirbtcToken == address(0) ||
            initialOwner == address(0)
        ) {
            revert ZeroAddress();
        }

        dexRouter = initialRouter;
        dexFactory = initialFactory;
        usdc = usdcToken;
        eurc = eurcToken;
        cirbtc = cirbtcToken;
        owner = initialOwner;
        allowedTokens[usdcToken] = true;
        allowedTokens[eurcToken] = true;
        allowedTokens[cirbtcToken] = true;

        emit OwnershipTransferred(address(0), initialOwner);
        emit DexRouterUpdated(address(0), initialRouter);
        emit DexFactoryUpdated(address(0), initialFactory);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setDexRouter(address newRouter) external onlyOwner {
        if (newRouter == address(0)) revert ZeroAddress();
        address previousRouter = dexRouter;
        dexRouter = newRouter;
        emit DexRouterUpdated(previousRouter, newRouter);
    }

    function setDexFactory(address newFactory) external onlyOwner {
        if (newFactory == address(0)) revert ZeroAddress();
        address previousFactory = dexFactory;
        dexFactory = newFactory;
        emit DexFactoryUpdated(previousFactory, newFactory);
    }

    function swapExactTokensForTokens(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        if (recipient == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert InvalidAmount();
        if (deadline < block.timestamp) revert ExpiredDeadline();

        address[] memory path = _buildPath(tokenIn, tokenOut);
        _validatePathLiquidity(path);

        _safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);
        _safeApprove(tokenIn, dexRouter, 0);
        _safeApprove(tokenIn, dexRouter, amountIn);

        amounts = IDexRouterMinimal(dexRouter).swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            recipient,
            deadline
        );

        uint256 amountOut = amounts[amounts.length - 1];
        if (amountOut < amountOutMin) revert SwapOutputTooLow();

        emit PaynaSwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, recipient, dexRouter);
    }

    function quotePath(address tokenIn, address tokenOut) external view returns (address[] memory path) {
        path = _buildPath(tokenIn, tokenOut);
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0) || to == address(0)) revert ZeroAddress();
        _safeTransfer(token, to, amount);
    }

    function _buildPath(address tokenIn, address tokenOut) internal view returns (address[] memory path) {
        if (!allowedTokens[tokenIn] || !allowedTokens[tokenOut]) revert InvalidToken();
        if (tokenIn == tokenOut) revert SameToken();

        if (tokenIn == usdc || tokenOut == usdc) {
            path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            return path;
        }

        path = new address[](3);
        path[0] = tokenIn;
        path[1] = usdc;
        path[2] = tokenOut;
    }

    function _validatePathLiquidity(address[] memory path) internal view {
        for (uint256 index = 0; index + 1 < path.length; index += 1) {
            address pair = IDexFactoryMinimal(dexFactory).getPair(path[index], path[index + 1]);
            if (pair == address(0)) revert PairNotFound(path[index], path[index + 1]);
            (uint112 reserve0, uint112 reserve1,) = IDexPairMinimal(pair).getReserves();
            if (reserve0 == 0 || reserve1 == 0) revert EmptyLiquidity(pair);
        }
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeCall(IERC20Minimal.transferFrom, (from, to, amount))
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
    }

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeCall(IERC20Minimal.transfer, (to, amount))
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
    }

    function _safeApprove(address token, address spender, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeCall(IERC20Minimal.approve, (spender, amount))
        );
        if (!success || (data.length != 0 && !abi.decode(data, (bool)))) revert SafeTransferFailed();
    }
}
