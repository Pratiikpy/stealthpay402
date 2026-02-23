// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title X402Lib - x402 Payment Verification Helpers
/// @notice Utilities for EIP-3009 transferWithAuthorization validation
/// @dev x402 Protocol uses EIP-3009 (transferWithAuthorization) for gasless USDC payments.
///      The agent signs an authorization off-chain, and the facilitator submits it on-chain.
library X402Lib {
    /// @notice Validate payment parameters before processing
    /// @param from The payer address
    /// @param amount The payment amount
    /// @param validAfter The earliest valid timestamp
    /// @param validBefore The latest valid timestamp
    /// @param nonce The unique payment nonce
    function validatePaymentParams(
        address from,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) internal view {
        require(from != address(0), "X402Lib: zero sender");
        require(amount > 0, "X402Lib: zero amount");
        require(block.timestamp >= validAfter, "X402Lib: not yet valid");
        require(block.timestamp < validBefore, "X402Lib: expired");
        require(nonce != bytes32(0), "X402Lib: zero nonce");
    }

    /// @notice Calculate platform fee from payment amount
    /// @param amount The payment amount
    /// @param feeBps The fee in basis points (1 bp = 0.01%)
    /// @return fee The calculated fee amount
    function calculateFee(uint256 amount, uint256 feeBps) internal pure returns (uint256 fee) {
        fee = (amount * feeBps) / 10000;
    }

    /// @notice Encode x402 payment response headers for HTTP 402
    /// @dev Used by the SDK to construct the payment requirement response
    /// @param amount Required payment amount
    /// @param token Token address (USDC)
    /// @param chainId The chain ID for payment
    /// @param receiver The payment receiver (router contract)
    /// @return The encoded payment requirement
    function encodePaymentRequirement(
        uint256 amount,
        address token,
        uint256 chainId,
        address receiver
    ) internal pure returns (bytes memory) {
        return abi.encode(amount, token, chainId, receiver);
    }

    /// @notice Decode a payment requirement
    /// @param data The encoded payment requirement
    /// @return amount The required amount
    /// @return token The token address
    /// @return chainId The chain ID
    /// @return receiver The receiver address
    function decodePaymentRequirement(
        bytes memory data
    ) internal pure returns (uint256 amount, address token, uint256 chainId, address receiver) {
        (amount, token, chainId, receiver) = abi.decode(data, (uint256, address, uint256, address));
    }
}
