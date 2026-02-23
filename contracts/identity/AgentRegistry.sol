// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAgentRegistry} from "../interfaces/IAgentRegistry.sol";

/// @title AgentRegistry - AI Agent Identity, Reputation, and Rate Limiting
/// @notice On-chain registry for AI agents that use StealthPay402. Each agent has:
///         - Identity: owner address + metadata hash (IPFS link to agent description)
///         - Rate limiting: daily spending cap that resets every 24 hours
///         - Reputation: 0-1000 score based on transaction history
///         - Stats: total transactions and volume for transparency
/// @dev Only the StealthPaymentRouter can call recordTransaction to enforce rate limits.
///      This prevents agents from bypassing spending caps by calling directly.
contract AgentRegistry is IAgentRegistry, Ownable, ReentrancyGuard {
    /// @notice The router contract (only address allowed to record transactions)
    address public router;

    /// @notice Fee to register a new agent (in native token, e.g., POL)
    uint256 public registrationFee;

    /// @notice Default daily spending limit for new agents (in USDC, 6 decimals)
    uint256 public defaultDailyLimit;

    /// @notice All registered agents
    mapping(address => Agent) private _agents;

    /// @notice Total number of registered agents
    uint256 public totalAgents;

    /// @notice One day in seconds for daily limit resets
    uint256 private constant ONE_DAY = 86400;

    modifier onlyRouter() {
        require(msg.sender == router, "AgentRegistry: caller is not router");
        _;
    }

    constructor() Ownable(msg.sender) {
        registrationFee = 0; // Free registration initially
        defaultDailyLimit = 1000 * 1e6; // 1000 USDC default daily limit
    }

    /// @inheritdoc IAgentRegistry
    function registerAgent(bytes32 metadataHash) external payable nonReentrant {
        require(!_agents[msg.sender].isActive, "AgentRegistry: already registered");
        require(msg.value >= registrationFee, "AgentRegistry: insufficient fee");

        _agents[msg.sender] = Agent({
            owner: msg.sender,
            metadataHash: metadataHash,
            dailySpendLimit: defaultDailyLimit,
            spentToday: 0,
            lastResetTimestamp: block.timestamp,
            reputationScore: 500, // Start at neutral reputation
            totalTransactions: 0,
            totalVolume: 0,
            isActive: true,
            registeredAt: block.timestamp
        });

        unchecked {
            totalAgents++;
        }

        emit AgentRegistered(msg.sender, metadataHash);
    }

    /// @inheritdoc IAgentRegistry
    function recordTransaction(address agent, uint256 amount) external onlyRouter {
        Agent storage a = _agents[agent];
        require(a.isActive, "AgentRegistry: agent not active");

        // Reset daily spend if 24 hours have passed
        if (block.timestamp >= a.lastResetTimestamp + ONE_DAY) {
            a.spentToday = 0;
            a.lastResetTimestamp = block.timestamp;
        }

        // Check daily limit
        require(
            a.spentToday + amount <= a.dailySpendLimit,
            "AgentRegistry: daily limit exceeded"
        );

        // Update stats
        a.spentToday += amount;
        a.totalTransactions++;
        a.totalVolume += amount;

        // Auto-update reputation based on history (simple algorithm)
        // More transactions = higher reputation, capped at 1000
        if (a.totalTransactions % 10 == 0 && a.reputationScore < 1000) {
            uint256 oldScore = a.reputationScore;
            uint256 newScore = a.reputationScore + 10;
            if (newScore > 1000) newScore = 1000;
            a.reputationScore = newScore;
            emit ReputationUpdated(agent, oldScore, newScore);
        }

        emit TransactionRecorded(agent, amount, a.totalTransactions);
    }

    /// @inheritdoc IAgentRegistry
    function updateReputation(address agent, uint256 score) external onlyOwner {
        require(score <= 1000, "AgentRegistry: score exceeds max");
        require(_agents[agent].isActive, "AgentRegistry: agent not active");

        uint256 oldScore = _agents[agent].reputationScore;
        _agents[agent].reputationScore = score;

        emit ReputationUpdated(agent, oldScore, score);
    }

    /// @inheritdoc IAgentRegistry
    function setDailyLimit(uint256 newLimit) external {
        require(_agents[msg.sender].isActive, "AgentRegistry: not registered");
        require(newLimit > 0, "AgentRegistry: zero limit");

        uint256 oldLimit = _agents[msg.sender].dailySpendLimit;
        _agents[msg.sender].dailySpendLimit = newLimit;

        emit DailyLimitUpdated(msg.sender, oldLimit, newLimit);
    }

    /// @inheritdoc IAgentRegistry
    function deactivateAgent(address agent) external onlyOwner {
        require(_agents[agent].isActive, "AgentRegistry: already inactive");
        _agents[agent].isActive = false;

        emit AgentDeactivated(agent);
    }

    /// @inheritdoc IAgentRegistry
    function getAgent(address agent) external view returns (Agent memory) {
        return _agents[agent];
    }

    /// @inheritdoc IAgentRegistry
    function isRegistered(address agent) external view returns (bool) {
        return _agents[agent].isActive;
    }

    // ─── Admin Functions ────────────────────────────────────

    /// @notice Set the router address (only router can call recordTransaction)
    function setRouter(address _router) external onlyOwner {
        require(_router != address(0), "AgentRegistry: zero router");
        router = _router;
    }

    /// @notice Update the registration fee
    function setRegistrationFee(uint256 _fee) external onlyOwner {
        registrationFee = _fee;
    }

    /// @notice Update the default daily limit for new agents
    function setDefaultDailyLimit(uint256 _limit) external onlyOwner {
        require(_limit > 0, "AgentRegistry: zero limit");
        defaultDailyLimit = _limit;
    }

    /// @notice Withdraw collected registration fees
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "AgentRegistry: no fees");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "AgentRegistry: withdraw failed");
    }
}
