// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ICrossChainRouter - AggLayer Cross-Chain Payment Router Interface
/// @notice Enables stealth payments across Polygon chains via AggLayer bridge
interface ICrossChainRouter {
    event CrossChainPaymentSent(
        uint32 indexed destinationChainId,
        address indexed stealthAddress,
        uint256 amount
    );
    event CrossChainPaymentReceived(
        uint32 indexed sourceChainId,
        address indexed stealthAddress,
        uint256 amount
    );

    /// @notice Send a stealth payment to another Polygon chain
    function sendCrossChainPayment(
        uint32 destinationChainId,
        address stealthAddress,
        uint256 amount,
        bytes calldata ephemeralPubKey,
        uint8 viewTag
    ) external;

    /// @notice Receive a cross-chain stealth payment (called by bridge)
    function receiveCrossChainPayment(bytes calldata message) external;

    /// @notice Set the router address on a remote chain
    function setRemoteRouter(uint32 chainId, address router) external;
}
