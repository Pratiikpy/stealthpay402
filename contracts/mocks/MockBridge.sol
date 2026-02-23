// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MockBridge - Mock AggLayer Bridge for Testing
/// @notice Simulates the PolygonZkEVMBridgeV2 for cross-chain message passing
/// @dev In production, replaced with the real AggLayer bridge contract
contract MockBridge {
    using SafeERC20 for IERC20;

    struct BridgedMessage {
        uint32 destinationChainId;
        address destinationAddress;
        bytes metadata;
        uint256 timestamp;
    }

    /// @notice All bridged messages for inspection
    BridgedMessage[] public messages;

    /// @notice Registered receivers that can claim messages
    mapping(address => bool) public registeredReceivers;

    event BridgeMessage(
        uint32 indexed destinationChainId,
        address indexed destinationAddress,
        bytes metadata
    );

    event MessageClaimed(uint256 indexed messageIndex, address indexed claimer);

    /// @notice Mock bridge message sending (simulates PolygonZkEVMBridgeV2.bridgeMessage)
    /// @param destinationChainId The target chain ID
    /// @param destinationAddress The address to receive the message on the destination chain
    /// @param forceUpdateGlobalExitRoot Whether to force an exit root update (ignored in mock)
    /// @param metadata The message payload
    function bridgeMessage(
        uint32 destinationChainId,
        address destinationAddress,
        bool forceUpdateGlobalExitRoot,
        bytes calldata metadata
    ) external payable {
        // Suppress unused variable warning
        forceUpdateGlobalExitRoot;

        messages.push(BridgedMessage({
            destinationChainId: destinationChainId,
            destinationAddress: destinationAddress,
            metadata: metadata,
            timestamp: block.timestamp
        }));

        emit BridgeMessage(destinationChainId, destinationAddress, metadata);
    }

    /// @notice Simulate message delivery on the destination chain
    /// @dev In testing, we call this to simulate the bridge delivering the message
    /// @param messageIndex The index of the message to deliver
    function claimMessage(uint256 messageIndex) external {
        require(messageIndex < messages.length, "MockBridge: invalid index");
        BridgedMessage memory msg_ = messages[messageIndex];

        // Call the destination address with the metadata
        (bool success, ) = msg_.destinationAddress.call(msg_.metadata);
        require(success, "MockBridge: delivery failed");

        emit MessageClaimed(messageIndex, msg.sender);
    }

    /// @notice Get the total number of bridged messages
    function messageCount() external view returns (uint256) {
        return messages.length;
    }

    /// @notice Get a specific bridged message
    function getMessage(uint256 index) external view returns (BridgedMessage memory) {
        require(index < messages.length, "MockBridge: invalid index");
        return messages[index];
    }
}
