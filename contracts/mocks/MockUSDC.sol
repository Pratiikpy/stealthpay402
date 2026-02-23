// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title MockUSDC - Test USDC with EIP-3009 transferWithAuthorization
/// @notice Implements the EIP-3009 standard used by real USDC for gasless transfers
/// @dev This is the core of x402: agents sign authorizations off-chain, facilitators submit them
contract MockUSDC is ERC20, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256(
            "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
        );

    /// @notice Track which nonces have been used (per-authorizer)
    mapping(address => mapping(bytes32 => bool)) private _authorizationStates;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    constructor() ERC20("USD Coin", "USDC") EIP712("USD Coin", "2") {}

    /// @notice USDC uses 6 decimals
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint tokens for testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice EIP-3009: Execute a transfer with a signed authorization
    /// @dev This is the key function that enables x402 gasless payments.
    ///      The token holder signs an authorization off-chain. Anyone can submit it.
    /// @param from The payer (must have signed the authorization)
    /// @param to The recipient
    /// @param value Amount of tokens to transfer
    /// @param validAfter Earliest timestamp the authorization is valid
    /// @param validBefore Latest timestamp the authorization is valid
    /// @param nonce Unique nonce to prevent replay
    /// @param signature The EIP-712 signature from the authorizer
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes memory signature
    ) external {
        require(block.timestamp >= validAfter, "MockUSDC: auth not yet valid");
        require(block.timestamp < validBefore, "MockUSDC: auth expired");
        require(!_authorizationStates[from][nonce], "MockUSDC: auth already used");

        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == from, "MockUSDC: invalid signature");

        _authorizationStates[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);

        _transfer(from, to, value);
    }

    /// @notice Check if an authorization nonce has been used
    /// @param authorizer The address that signed the authorization
    /// @param nonce The nonce to check
    /// @return True if the nonce has been used
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }

    /// @notice Get the EIP-712 domain separator
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
