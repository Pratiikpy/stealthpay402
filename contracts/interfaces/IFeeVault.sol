// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

/// @title IFeeVault - ERC-4626 Fee Collection Vault Interface
/// @notice Extends ERC4626 with treasury management
interface IFeeVault is IERC4626 {
    event TreasuryWithdrawal(address indexed treasury, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /// @notice Withdraw accumulated fees to the treasury
    /// @param amount The amount of USDC to withdraw
    function withdrawToTreasury(uint256 amount) external;

    /// @notice Update the treasury address
    /// @param newTreasury The new treasury address
    function setTreasury(address newTreasury) external;

    /// @notice Get the current treasury address
    function treasury() external view returns (address);
}
