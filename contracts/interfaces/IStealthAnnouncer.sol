// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IStealthAnnouncer - ERC-5564 Stealth Address Announcement Interface
/// @notice Emits events for recipients to scan and find payments addressed to them
interface IStealthAnnouncer {
    /// @notice Emitted when a stealth payment is announced
    /// @param schemeId The stealth address scheme (1 = secp256k1)
    /// @param stealthAddress The one-time stealth address receiving funds
    /// @param caller The contract or EOA that triggered the announcement
    /// @param ephemeralPubKey The sender's ephemeral public key for key derivation
    /// @param metadata Additional data (view tag encoded as first byte)
    event Announcement(
        uint256 indexed schemeId,
        address indexed stealthAddress,
        address indexed caller,
        bytes ephemeralPubKey,
        bytes metadata
    );

    /// @notice Announce a stealth payment for recipient scanning
    /// @param schemeId The stealth address scheme identifier
    /// @param stealthAddress The generated stealth address
    /// @param ephemeralPubKey Sender's ephemeral public key
    /// @param metadata View tag and optional extra data
    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external;
}
