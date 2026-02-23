// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IStealthAnnouncer} from "../interfaces/IStealthAnnouncer.sol";
import {IAgentRegistry} from "../interfaces/IAgentRegistry.sol";
import {IComplianceGate} from "../interfaces/IComplianceGate.sol";
import {X402Lib} from "../libraries/X402Lib.sol";

/// @title StealthPaymentRouter - Core x402 Privacy Payment Orchestrator
/// @notice Routes x402 payments through ERC-5564 stealth addresses on Polygon.
///         This is the heart of StealthPay402: it receives signed EIP-3009 payment
///         authorizations, verifies them, deducts a platform fee, routes funds to
///         a one-time stealth address, and announces the payment for recipient scanning.
/// @dev Payment flow:
///      1. AI agent signs EIP-3009 transferWithAuthorization for USDC
///      2. Facilitator (or agent) calls processPayment with the signed authorization
///      3. Router calls USDC.transferWithAuthorization to pull funds from agent → router
///      4. Router deducts platform fee → FeeVault
///      5. Router sends remaining USDC → stealth address
///      6. Router calls StealthAnnouncer.announce() with ephemeral pubkey + view tag
///      7. Recipient later scans announcements, finds payment, derives spending key, claims
contract StealthPaymentRouter is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Payment parameters for a single x402 stealth payment
    struct PaymentParams {
        address from;              // Payer (AI agent wallet)
        uint256 amount;            // USDC amount (6 decimals)
        bytes32 nonce;             // Unique nonce for EIP-3009 replay prevention
        uint256 validAfter;        // EIP-3009: earliest valid timestamp
        uint256 validBefore;       // EIP-3009: latest valid timestamp
        address stealthAddress;    // One-time recipient stealth address
        bytes ephemeralPubKey;     // Sender's ephemeral pubkey for recipient key derivation
        uint8 viewTag;             // Quick-scan filter byte (first byte of shared secret hash)
        bytes signature;           // EIP-3009 transferWithAuthorization signature
    }

    // ─── State ──────────────────────────────────────────────

    IERC20 public immutable usdc;
    IStealthAnnouncer public announcer;
    address public feeVault;
    IAgentRegistry public agentRegistry;
    IComplianceGate public complianceGate;

    uint256 public platformFeeBps;
    uint256 public constant MAX_FEE = 100; // 1% max fee cap

    /// @notice Track processed nonces to prevent replay attacks
    mapping(bytes32 => bool) public processed;

    /// @notice Approved facilitators that can submit payments on behalf of agents
    mapping(address => bool) public approvedFacilitators;

    // ─── Events ─────────────────────────────────────────────

    event PaymentProcessed(
        address indexed from,
        address indexed stealthAddress,
        uint256 amount,
        uint256 fee,
        bytes32 nonce
    );

    event BatchProcessed(uint256 count, uint256 totalAmount, uint256 totalFees);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FacilitatorUpdated(address indexed facilitator, bool approved);
    event AnnouncerUpdated(address indexed oldAnnouncer, address indexed newAnnouncer);
    event FeeVaultUpdated(address indexed oldVault, address indexed newVault);
    event AgentRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);
    event ComplianceGateUpdated(address indexed oldGate, address indexed newGate);
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);

    // ─── Constructor ────────────────────────────────────────

    /// @param _usdc USDC token address (6 decimals)
    /// @param _announcer ERC-5564 announcement contract
    /// @param _feeVault ERC-4626 fee collection vault
    constructor(
        address _usdc,
        address _announcer,
        address _feeVault
    ) Ownable(msg.sender) {
        require(_usdc != address(0), "Router: zero USDC");
        require(_announcer != address(0), "Router: zero announcer");
        require(_feeVault != address(0), "Router: zero vault");

        usdc = IERC20(_usdc);
        announcer = IStealthAnnouncer(_announcer);
        feeVault = _feeVault;
        platformFeeBps = 10; // 0.1% default fee
    }

    // ─── Core Payment Functions ─────────────────────────────

    /// @notice Process a single x402 stealth payment
    /// @dev This is the primary entry point. The full x402 + stealth flow in one call.
    /// @param params The payment parameters including EIP-3009 signature
    function processPayment(PaymentParams calldata params) external nonReentrant whenNotPaused {
        _processPayment(params);
    }

    /// @notice Process multiple payments in a single transaction
    /// @dev Useful for batching multiple agent payments to reduce gas
    /// @param params Array of payment parameters
    function batchProcessPayments(PaymentParams[] calldata params) external nonReentrant whenNotPaused {
        require(params.length > 0, "Router: empty batch");
        require(params.length <= 50, "Router: batch too large");

        uint256 totalAmount;
        uint256 totalFees;

        for (uint256 i = 0; i < params.length; i++) {
            (uint256 amount, uint256 fee) = _processPayment(params[i]);
            totalAmount += amount;
            totalFees += fee;
        }

        emit BatchProcessed(params.length, totalAmount, totalFees);
    }

    /// @notice Internal payment processing logic
    /// @dev Follows checks-effects-interactions pattern
    function _processPayment(PaymentParams calldata params) internal returns (uint256, uint256) {
        // ── Checks ──
        require(!processed[params.nonce], "Router: already processed");
        require(params.stealthAddress != address(0), "Router: zero stealth address");
        require(params.amount > 0, "Router: zero amount");
        require(params.ephemeralPubKey.length == 33 || params.ephemeralPubKey.length == 65, "Router: invalid ephemeral key length");

        // ── Effects ──
        processed[params.nonce] = true;

        // Compliance check (if gate is set and compliance is required)
        if (address(complianceGate) != address(0)) {
            require(
                complianceGate.checkCompliance(params.from),
                "Router: compliance check failed"
            );
        }

        // Agent registry check (if registry is set)
        if (address(agentRegistry) != address(0)) {
            if (agentRegistry.isRegistered(params.from)) {
                agentRegistry.recordTransaction(params.from, params.amount);
            }
        }

        // ── Interactions ──

        // Step 1: Pull USDC from payer via EIP-3009 transferWithAuthorization
        // This calls USDC.transferWithAuthorization(from, address(this), amount, ...)
        // The payer signed this authorization off-chain — gasless for them
        bytes memory twaCalldata = abi.encodeWithSignature(
            "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,bytes)",
            params.from,
            address(this),
            params.amount,
            params.validAfter,
            params.validBefore,
            params.nonce,
            params.signature
        );
        (bool twaSuccess, ) = address(usdc).call(twaCalldata);
        require(twaSuccess, "Router: transferWithAuthorization failed");

        // Step 2: Calculate and route fees
        uint256 fee = X402Lib.calculateFee(params.amount, platformFeeBps);
        uint256 recipientAmount = params.amount - fee;

        // Step 3: Send fee to vault
        if (fee > 0) {
            usdc.safeTransfer(feeVault, fee);
        }

        // Step 4: Send remaining USDC to stealth address
        usdc.safeTransfer(params.stealthAddress, recipientAmount);

        // Step 5: Announce the stealth payment (ERC-5564)
        announcer.announce(
            1, // SCHEME_ID for secp256k1
            params.stealthAddress,
            params.ephemeralPubKey,
            abi.encodePacked(params.viewTag)
        );

        emit PaymentProcessed(
            params.from,
            params.stealthAddress,
            params.amount,
            fee,
            params.nonce
        );

        return (params.amount, fee);
    }

    // ─── Admin Functions ────────────────────────────────────

    /// @notice Update the platform fee (in basis points)
    /// @param newFeeBps The new fee (max 100 = 1%)
    function setFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE, "Router: fee exceeds max");
        uint256 oldFee = platformFeeBps;
        platformFeeBps = newFeeBps;
        emit FeeUpdated(oldFee, newFeeBps);
    }

    /// @notice Update the stealth announcer contract
    function setAnnouncer(address _announcer) external onlyOwner {
        require(_announcer != address(0), "Router: zero announcer");
        address old = address(announcer);
        announcer = IStealthAnnouncer(_announcer);
        emit AnnouncerUpdated(old, _announcer);
    }

    /// @notice Update the fee vault address
    function setFeeVault(address _feeVault) external onlyOwner {
        require(_feeVault != address(0), "Router: zero vault");
        address old = feeVault;
        feeVault = _feeVault;
        emit FeeVaultUpdated(old, _feeVault);
    }

    /// @notice Update the agent registry
    function setAgentRegistry(address _registry) external onlyOwner {
        address old = address(agentRegistry);
        agentRegistry = IAgentRegistry(_registry);
        emit AgentRegistryUpdated(old, _registry);
    }

    /// @notice Update the compliance gate
    function setComplianceGate(address _gate) external onlyOwner {
        address old = address(complianceGate);
        complianceGate = IComplianceGate(_gate);
        emit ComplianceGateUpdated(old, _gate);
    }

    /// @notice Approve or revoke a facilitator
    function setApprovedFacilitator(address facilitator, bool approved) external onlyOwner {
        require(facilitator != address(0), "Router: zero facilitator");
        approvedFacilitators[facilitator] = approved;
        emit FacilitatorUpdated(facilitator, approved);
    }

    /// @notice Pause all payment processing (emergency)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause payment processing
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Emergency withdrawal of stuck tokens
    /// @param token The token to withdraw (address(0) for native)
    /// @param amount The amount to withdraw
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success, ) = payable(owner()).call{value: amount}("");
            require(success, "Router: ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
        emit EmergencyWithdraw(token, amount, owner());
    }
}
