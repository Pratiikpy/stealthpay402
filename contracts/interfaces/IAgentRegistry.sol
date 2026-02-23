// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IAgentRegistry - AI Agent Identity and Reputation Interface
/// @notice Manages agent registration, rate limits, and reputation scores
interface IAgentRegistry {
    struct Agent {
        address owner;
        bytes32 metadataHash;
        uint256 dailySpendLimit;
        uint256 spentToday;
        uint256 lastResetTimestamp;
        uint256 reputationScore;
        uint256 totalTransactions;
        uint256 totalVolume;
        bool isActive;
        uint256 registeredAt;
    }

    event AgentRegistered(address indexed agent, bytes32 metadataHash);
    event AgentDeactivated(address indexed agent);
    event DailyLimitUpdated(address indexed agent, uint256 oldLimit, uint256 newLimit);
    event ReputationUpdated(address indexed agent, uint256 oldScore, uint256 newScore);
    event TransactionRecorded(address indexed agent, uint256 amount, uint256 newTotal);

    function registerAgent(bytes32 metadataHash) external payable;
    function recordTransaction(address agent, uint256 amount) external;
    function updateReputation(address agent, uint256 score) external;
    function setDailyLimit(uint256 newLimit) external;
    function deactivateAgent(address agent) external;
    function getAgent(address agent) external view returns (Agent memory);
    function isRegistered(address agent) external view returns (bool);
}
