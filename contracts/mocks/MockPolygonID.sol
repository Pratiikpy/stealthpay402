// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockPolygonID - Mock Polygon ID Verifier for Testing
/// @notice Simulates the Polygon ID credentialAtomicQuerySigV2 verifier
/// @dev In production, this would be replaced with the real Polygon ID verifier contract
contract MockPolygonID {
    /// @notice Track verified addresses
    mapping(address => bool) public verified;

    /// @notice Mock ZK proof verification result
    mapping(bytes32 => bool) public proofResults;

    event ProofVerified(address indexed user, bytes32 proofHash, bool result);

    /// @notice Set a proof result for testing
    /// @param proofHash Hash of the proof to set result for
    /// @param result Whether the proof should pass verification
    function setProofResult(bytes32 proofHash, bool result) external {
        proofResults[proofHash] = result;
    }

    /// @notice Mock verify function matching Polygon ID interface
    /// @param user The address being verified
    /// @param proof The ZK proof bytes
    /// @return True if the proof is valid
    function verify(address user, bytes calldata proof) external returns (bool) {
        bytes32 proofHash = keccak256(proof);
        bool result = proofResults[proofHash];

        if (result) {
            verified[user] = true;
        }

        emit ProofVerified(user, proofHash, result);
        return result;
    }

    /// @notice Check if an address has been verified
    /// @param user The address to check
    /// @return True if previously verified
    function isVerified(address user) external view returns (bool) {
        return verified[user];
    }

    /// @notice Manually set verification status for testing
    function setVerified(address user, bool status) external {
        verified[user] = status;
    }
}
