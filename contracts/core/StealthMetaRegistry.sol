// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IStealthMetaRegistry} from "../interfaces/IStealthMetaRegistry.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title StealthMetaRegistry - ERC-6538 Stealth Meta-Address Registry
/// @notice Stores stealth meta-addresses so senders can look up recipients and generate
///         stealth addresses for them. A meta-address contains the recipient's spending
///         public key and viewing public key.
/// @dev Implements ERC-6538: Registry for Stealth Meta-Addresses.
///
///      A stealth meta-address is formatted as:
///        spending_pubkey (33 bytes compressed) || viewing_pubkey (33 bytes compressed) = 66 bytes
///
///      Senders use the meta-address to:
///      1. Generate an ephemeral keypair
///      2. Compute ECDH shared secret with the viewing key
///      3. Derive a one-time stealth address from the spending key + shared secret
///      4. Send funds to that stealth address
///      5. Announce the ephemeral public key so the recipient can find the payment
contract StealthMetaRegistry is IStealthMetaRegistry, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant REGISTER_KEYS_TYPEHASH =
        keccak256(
            "RegisterKeys(address registrant,uint256 schemeId,bytes stealthMetaAddress,uint256 nonce)"
        );

    /// @notice registrant => schemeId => stealthMetaAddress
    mapping(address => mapping(uint256 => bytes)) private _stealthMetaAddresses;

    /// @notice Nonces for EIP-712 signature replay prevention
    mapping(address => uint256) public nonces;

    constructor() EIP712("StealthMetaRegistry", "1") {}

    /// @inheritdoc IStealthMetaRegistry
    function registerKeys(uint256 schemeId, bytes calldata stealthMetaAddress) external {
        require(stealthMetaAddress.length > 0, "StealthMetaRegistry: empty meta-address");
        require(schemeId > 0, "StealthMetaRegistry: invalid scheme");

        _stealthMetaAddresses[msg.sender][schemeId] = stealthMetaAddress;

        emit StealthMetaAddressSet(msg.sender, schemeId, stealthMetaAddress);
    }

    /// @inheritdoc IStealthMetaRegistry
    function registerKeysOnBehalf(
        address registrant,
        uint256 schemeId,
        bytes calldata stealthMetaAddress,
        bytes calldata signature
    ) external {
        require(registrant != address(0), "StealthMetaRegistry: zero registrant");
        require(stealthMetaAddress.length > 0, "StealthMetaRegistry: empty meta-address");
        require(schemeId > 0, "StealthMetaRegistry: invalid scheme");

        uint256 currentNonce = nonces[registrant];

        bytes32 structHash = keccak256(
            abi.encode(
                REGISTER_KEYS_TYPEHASH,
                registrant,
                schemeId,
                keccak256(stealthMetaAddress),
                currentNonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == registrant, "StealthMetaRegistry: invalid signature");

        nonces[registrant] = currentNonce + 1;
        _stealthMetaAddresses[registrant][schemeId] = stealthMetaAddress;

        emit StealthMetaAddressSet(registrant, schemeId, stealthMetaAddress);
    }

    /// @inheritdoc IStealthMetaRegistry
    function stealthMetaAddressOf(
        address registrant,
        uint256 schemeId
    ) external view returns (bytes memory) {
        return _stealthMetaAddresses[registrant][schemeId];
    }

    /// @notice Get the EIP-712 domain separator
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
