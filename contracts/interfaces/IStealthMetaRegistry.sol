// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IStealthMetaRegistry - ERC-6538 Stealth Meta-Address Registry
/// @notice Stores stealth meta-addresses so senders can look up recipients
interface IStealthMetaRegistry {
    /// @notice Emitted when a stealth meta-address is registered or updated
    event StealthMetaAddressSet(
        address indexed registrant,
        uint256 indexed schemeId,
        bytes stealthMetaAddress
    );

    /// @notice Register stealth meta-address keys for the caller
    /// @param schemeId The stealth address scheme (1 = secp256k1)
    /// @param stealthMetaAddress The stealth meta-address (spending + viewing pubkeys)
    function registerKeys(uint256 schemeId, bytes calldata stealthMetaAddress) external;

    /// @notice Register keys on behalf of another address with their signature
    /// @param registrant The address to register keys for
    /// @param schemeId The stealth address scheme
    /// @param stealthMetaAddress The stealth meta-address
    /// @param signature EIP-712 signature from the registrant
    function registerKeysOnBehalf(
        address registrant,
        uint256 schemeId,
        bytes calldata stealthMetaAddress,
        bytes calldata signature
    ) external;

    /// @notice Get the stealth meta-address for a registrant
    /// @param registrant The address to look up
    /// @param schemeId The stealth address scheme
    /// @return The stealth meta-address bytes
    function stealthMetaAddressOf(
        address registrant,
        uint256 schemeId
    ) external view returns (bytes memory);
}
