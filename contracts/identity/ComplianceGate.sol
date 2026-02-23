// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IComplianceGate} from "../interfaces/IComplianceGate.sol";

/// @title ComplianceGate - Optional ZK-KYC Compliance Layer
/// @notice Provides optional compliance verification using Polygon ID's zero-knowledge
///         proof system. Agents can prove they meet compliance requirements (e.g., KYC,
///         jurisdiction checks) without revealing their identity.
/// @dev Integration with Polygon ID:
///      - Production: Uses credentialAtomicQuerySigV2 verifier
///      - Testing: Uses MockPolygonID with manual verification
///
///      The compliance gate is OPTIONAL — when complianceRequired is false, all agents
///      pass the check. This allows gradual compliance rollout:
///      1. Launch without compliance (fast adoption)
///      2. Enable compliance for enterprise users
///      3. Full compliance for regulated markets
contract ComplianceGate is IComplianceGate, Ownable {
    /// @notice Address of the Polygon ID verifier contract
    address public verifier;

    /// @notice ZK proof request ID for the compliance query
    uint64 public requestId;

    /// @notice Whether compliance verification is required for payments
    bool public complianceRequired;

    /// @notice How long a compliance verification remains valid (default: 365 days)
    uint256 public complianceExpiry = 365 days;

    /// @notice Track compliance status per address
    mapping(address => bool) public isCompliant;

    /// @notice Timestamp of when each address was verified
    mapping(address => uint256) public verifiedAt;

    constructor() Ownable(msg.sender) {
        complianceRequired = false; // Start with compliance disabled
    }

    /// @inheritdoc IComplianceGate
    function verifyCompliance(address agent, bytes calldata zkProof) external {
        require(agent != address(0), "ComplianceGate: zero agent");
        require(zkProof.length > 0, "ComplianceGate: empty proof");

        bool verified;

        if (verifier != address(0)) {
            // Call the Polygon ID verifier (or MockPolygonID in testing)
            (bool success, bytes memory result) = verifier.call(
                abi.encodeWithSignature("verify(address,bytes)", agent, zkProof)
            );
            require(success, "ComplianceGate: verifier call failed");
            verified = abi.decode(result, (bool));
        } else {
            // No verifier set — auto-verify (useful for initial deployment)
            verified = true;
        }

        require(verified, "ComplianceGate: proof invalid");

        isCompliant[agent] = true;
        verifiedAt[agent] = block.timestamp;

        emit ComplianceVerified(agent, block.timestamp);
    }

    /// @inheritdoc IComplianceGate
    function checkCompliance(address agent) external view returns (bool) {
        if (!complianceRequired) {
            return true;
        }
        if (!isCompliant[agent]) {
            return false;
        }
        // Check if compliance has expired
        if (block.timestamp > verifiedAt[agent] + complianceExpiry) {
            return false;
        }
        return true;
    }

    /// @notice Update the compliance expiry duration
    /// @param _expiry New expiry duration in seconds
    function setComplianceExpiry(uint256 _expiry) external onlyOwner {
        require(_expiry >= 1 days, "ComplianceGate: expiry too short");
        complianceExpiry = _expiry;
    }

    /// @inheritdoc IComplianceGate
    function setComplianceRequired(bool required) external onlyOwner {
        complianceRequired = required;
        emit ComplianceRequirementChanged(required);
    }

    /// @notice Set the Polygon ID verifier contract address
    function setVerifier(address _verifier) external onlyOwner {
        verifier = _verifier;
    }

    /// @notice Set the ZK proof request ID
    function setRequestId(uint64 _requestId) external onlyOwner {
        requestId = _requestId;
    }

    /// @notice Manually set compliance status (admin override for testing/emergencies)
    function setCompliance(address agent, bool status) external onlyOwner {
        isCompliant[agent] = status;
        if (status) {
            verifiedAt[agent] = block.timestamp;
            emit ComplianceVerified(agent, block.timestamp);
        }
    }
}
