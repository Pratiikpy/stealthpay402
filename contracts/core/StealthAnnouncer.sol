// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IStealthAnnouncer} from "../interfaces/IStealthAnnouncer.sol";

/// @title StealthAnnouncer - ERC-5564 Stealth Address Announcement Registry
/// @notice Emits announcement events that recipients scan to discover payments addressed to them.
/// @dev Follows the ERC-5564 specification for stealth address announcements.
///      The announcement contains the ephemeral public key and view tag that recipients
///      need to check if a payment is for them. Only the intended recipient can identify
///      their payments by performing ECDH with their viewing key.
///
///      Scanning process:
///      1. Recipient listens for Announcement events
///      2. First checks view tag (1 byte) for quick filtering (~1/256 false positives)
///      3. If view tag matches, performs full ECDH check with viewing key
///      4. If confirmed, derives spending key to claim the funds
contract StealthAnnouncer is IStealthAnnouncer {
    /// @notice The stealth address scheme ID for secp256k1
    uint256 public constant SCHEME_ID = 1;

    /// @notice Total number of announcements made
    uint256 public announcementCount;

    /// @notice Track announced stealth addresses to prevent duplicates
    mapping(address => bool) public announced;

    /// @inheritdoc IStealthAnnouncer
    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external {
        require(schemeId == SCHEME_ID, "StealthAnnouncer: unsupported scheme");
        require(stealthAddress != address(0), "StealthAnnouncer: zero stealth address");
        require(ephemeralPubKey.length == 33 || ephemeralPubKey.length == 65, "StealthAnnouncer: invalid ephemeral key length");
        require(!announced[stealthAddress], "StealthAnnouncer: already announced");

        announced[stealthAddress] = true;

        unchecked {
            announcementCount++;
        }

        emit Announcement(schemeId, stealthAddress, msg.sender, ephemeralPubKey, metadata);
    }
}
