// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IComplianceGate - ZK-KYC Compliance Verification Interface
/// @notice Optional compliance layer using Polygon ID for zero-knowledge verification
interface IComplianceGate {
    event ComplianceVerified(address indexed agent, uint256 timestamp);
    event ComplianceRequirementChanged(bool required);

    /// @notice Verify an agent's compliance using ZK proof
    /// @param agent The agent address to verify
    /// @param zkProof The zero-knowledge proof data
    function verifyCompliance(address agent, bytes calldata zkProof) external;

    /// @notice Check if an agent is compliant
    /// @param agent The agent address to check
    /// @return True if compliant or compliance not required
    function checkCompliance(address agent) external view returns (bool);

    /// @notice Toggle compliance requirement globally
    /// @param required Whether compliance is required
    function setComplianceRequired(bool required) external;
}
