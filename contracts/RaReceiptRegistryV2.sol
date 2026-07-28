// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract RaReceiptRegistryV2 {
    uint8 public constant ACTION_BRIDGE = 1;
    uint8 public constant ACTION_TRANSFER = 2;
    uint8 public constant ACTION_PAY = 3;
    uint8 public constant ACTION_SWAP = 4;

    address public owner;
    mapping(address recorder => bool allowed) public recorders;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RecorderUpdated(address indexed recorder, bool allowed);
    event ReceiptRecorded(
        bytes32 indexed commandId,
        uint8 indexed actionType,
        address indexed user,
        address recipient,
        uint256 amountAtomic,
        uint256 sourceChainId,
        uint256 destinationChainId,
        bytes32 sourceTxHash,
        bytes32 destinationTxHash,
        bytes32 metadataHash
    );

    error NotOwner();
    error NotRecorder();
    error ZeroAddress();
    error InvalidActionType();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyRecorder() {
        if (!recorders[msg.sender]) revert NotRecorder();
        _;
    }

    constructor(address initialRecorder) {
        owner = msg.sender;
        recorders[msg.sender] = true;
        emit OwnershipTransferred(address(0), msg.sender);
        emit RecorderUpdated(msg.sender, true);

        if (initialRecorder != address(0) && initialRecorder != msg.sender) {
            recorders[initialRecorder] = true;
            emit RecorderUpdated(initialRecorder, true);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setRecorder(address recorder, bool allowed) external onlyOwner {
        if (recorder == address(0)) revert ZeroAddress();
        recorders[recorder] = allowed;
        emit RecorderUpdated(recorder, allowed);
    }

    function recordReceipt(
        bytes32 commandId,
        uint8 actionType,
        address user,
        address recipient,
        uint256 amountAtomic,
        uint256 sourceChainId,
        uint256 destinationChainId,
        bytes32 sourceTxHash,
        bytes32 destinationTxHash,
        bytes32 metadataHash
    ) external onlyRecorder {
        if (actionType == 0 || actionType > ACTION_SWAP) revert InvalidActionType();

        emit ReceiptRecorded(
            commandId,
            actionType,
            user,
            recipient,
            amountAtomic,
            sourceChainId,
            destinationChainId,
            sourceTxHash,
            destinationTxHash,
            metadataHash
        );
    }
}
