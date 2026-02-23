// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title StealthLib - Stealth Address Math Utilities
/// @notice On-chain helpers for ERC-5564 stealth address verification
/// @dev The heavy crypto (point multiplication) is done off-chain in the SDK.
///      This library provides on-chain validation and view tag computation.
library StealthLib {
    /// @notice Compute a view tag from a shared secret hash
    /// @dev View tag = first byte of keccak256(sharedSecret)
    ///      Used for fast-scan filtering: recipients check the view tag first
    ///      before doing expensive EC math. ~1/256 false positive rate.
    /// @param sharedSecretHash The hash of the ECDH shared secret
    /// @return The single-byte view tag
    function computeViewTag(bytes32 sharedSecretHash) internal pure returns (uint8) {
        return uint8(sharedSecretHash[0]);
    }

    /// @notice Derive a stealth address from public key components
    /// @dev stealthAddress = pubToAddr(spendingPubKey + hash(sharedSecret) * G)
    ///      This is the simplified on-chain version. Full derivation in SDK.
    /// @param spendingPubKeyHash Hash of the recipient's spending public key
    /// @param sharedSecretHash Hash of the ECDH shared secret
    /// @return The derived stealth address
    function deriveStealthAddressHash(
        bytes32 spendingPubKeyHash,
        bytes32 sharedSecretHash
    ) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(spendingPubKeyHash, sharedSecretHash)))));
    }

    /// @notice Validate that a stealth meta-address has correct format
    /// @dev Meta-address format: spending_pubkey (33 bytes) + viewing_pubkey (33 bytes) = 66 bytes
    ///      For uncompressed: 65 + 65 = 130 bytes
    /// @param metaAddress The stealth meta-address to validate
    /// @return True if the meta-address has a valid length
    function isValidMetaAddress(bytes memory metaAddress) internal pure returns (bool) {
        return metaAddress.length == 66 || metaAddress.length == 130;
    }

    /// @notice Validate ephemeral public key format
    /// @dev Compressed: 33 bytes (02/03 prefix), Uncompressed: 65 bytes (04 prefix)
    /// @param pubKey The ephemeral public key
    /// @return True if the public key has a valid length and prefix
    function isValidEphemeralPubKey(bytes memory pubKey) internal pure returns (bool) {
        if (pubKey.length == 33) {
            uint8 prefix = uint8(pubKey[0]);
            return prefix == 0x02 || prefix == 0x03;
        }
        if (pubKey.length == 65) {
            return uint8(pubKey[0]) == 0x04;
        }
        return false;
    }

    /// @notice Extract the view tag byte from metadata
    /// @param metadata The announcement metadata (view tag is first byte)
    /// @return The view tag byte
    function extractViewTag(bytes memory metadata) internal pure returns (uint8) {
        require(metadata.length >= 1, "StealthLib: empty metadata");
        return uint8(metadata[0]);
    }
}
