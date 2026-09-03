/**
 * Shared Expense Module - Split Calculator
 *
 * Calculates how to split expenses based on different split types.
 * This utility handles all split logic to ensure consistency.
 *
 * @module expenses/split-calculator
 */

import { ExpenseSplitTypeEnum, SplitConfig } from "./expense.types";
import { ExpenseSplitException } from "./expense.exceptions";

/**
 * Split calculation result
 */
export interface SplitCalculation {
  [userId: string]: number; // userId -> amount owed
}

/**
 * Shared expense split calculator
 * Handles calculations for different split types
 */
export class SplitCalculator {
  /**
   * Calculates how much each participant owes based on split type
   *
   * @param totalAmount - Total expense amount
   * @param splitType - Type of split (EQUAL, BY_AMOUNT, BY_PERCENTAGE, ITEMIZED)
   * @param participantIds - List of participant user IDs
   * @param splitConfig - Split configuration (required for some types)
   * @returns Object mapping userId to their owed amount
   * @throws {ExpenseSplitException} If calculation fails
   *
   * @example
   * // Equal split among 3 people for $90
   * const split = calculator.calculateSplit(
   *   90,
   *   ExpenseSplitTypeEnum.EQUAL,
   *   ["user1", "user2", "user3"]
   * );
   * // Result: { user1: 30, user2: 30, user3: 30 }
   */
  calculateSplit(
    totalAmount: number,
    splitType: ExpenseSplitTypeEnum,
    participantIds: string[],
    splitConfig?: SplitConfig
  ): SplitCalculation {
    if (!participantIds || participantIds.length === 0) {
      throw new ExpenseSplitException("At least one participant required for split calculation");
    }

    if (totalAmount <= 0) {
      throw new ExpenseSplitException("Total amount must be greater than 0");
    }

    switch (splitType) {
      case ExpenseSplitTypeEnum.EQUAL:
        return this.calculateEqualSplit(totalAmount, participantIds);

      case ExpenseSplitTypeEnum.BY_AMOUNT:
        if (!splitConfig || splitConfig.type !== ExpenseSplitTypeEnum.BY_AMOUNT) {
          throw new ExpenseSplitException("Split config required for BY_AMOUNT split");
        }
        return this.calculateAmountSplit(totalAmount, participantIds, splitConfig.splits);

      case ExpenseSplitTypeEnum.BY_PERCENTAGE:
        if (!splitConfig || splitConfig.type !== ExpenseSplitTypeEnum.BY_PERCENTAGE) {
          throw new ExpenseSplitException("Split config required for BY_PERCENTAGE split");
        }
        return this.calculatePercentageSplit(totalAmount, participantIds, splitConfig.splits);

      case ExpenseSplitTypeEnum.ITEMIZED:
        if (!splitConfig || splitConfig.type !== ExpenseSplitTypeEnum.ITEMIZED) {
          throw new ExpenseSplitException("Split config required for ITEMIZED split");
        }
        return this.calculateItemizedSplit(totalAmount, participantIds, splitConfig.items);

      default:
        throw new ExpenseSplitException(`Unknown split type: ${splitType}`);
    }
  }

  /**
   * Calculates equal split - divides total evenly among all participants
   *
   * @private
   * @param totalAmount - Total expense amount
   * @param participantIds - List of participant IDs
   * @returns Split calculation
   */
  private calculateEqualSplit(
    totalAmount: number,
    participantIds: string[]
  ): SplitCalculation {
    const perPerson = Math.round((totalAmount / participantIds.length) * 100) / 100;
    const result: SplitCalculation = {};

    // Distribute equal shares
    let totalDistributed = 0;
    for (let i = 0; i < participantIds.length - 1; i++) {
      result[participantIds[i]] = perPerson;
      totalDistributed += perPerson;
    }

    // Last participant gets remainder (to handle rounding)
    result[participantIds[participantIds.length - 1]] = 
      Math.round((totalAmount - totalDistributed) * 100) / 100;

    return result;
  }

  /**
   * Calculates split by specific amounts per person
   *
   * @private
   * @param totalAmount - Total expense amount
   * @param participantIds - List of participant IDs
   * @param splits - Map of userId to amount
   * @returns Split calculation
   * @throws {ExpenseSplitException} If amounts don't sum to total or missing participants
   */
  private calculateAmountSplit(
    totalAmount: number,
    participantIds: string[],
    splits: Record<string, number>
  ): SplitCalculation {
    const result: SplitCalculation = {};
    let sum = 0;

    // Verify all participants have amounts specified
    for (const userId of participantIds) {
      if (!(userId in splits)) {
        throw new ExpenseSplitException(`Amount not specified for participant ${userId}`);
      }

      const amount = splits[userId];
      if (amount < 0) {
        throw new ExpenseSplitException(`Negative amount not allowed: ${userId} -> ${amount}`);
      }

      result[userId] = amount;
      sum += amount;
    }

    // Verify total matches (allow small rounding difference)
    if (Math.abs(sum - totalAmount) > 0.01) {
      throw new ExpenseSplitException(
        `Split amounts sum to ${sum}, but total is ${totalAmount}`,
        { expectedTotal: totalAmount, actualSum: sum }
      );
    }

    return result;
  }

  /**
   * Calculates split by percentage per person
   *
   * @private
   * @param totalAmount - Total expense amount
   * @param participantIds - List of participant IDs
   * @param splits - Map of userId to percentage (0-100)
   * @returns Split calculation
   * @throws {ExpenseSplitException} If percentages don't sum to 100 or missing participants
   */
  private calculatePercentageSplit(
    totalAmount: number,
    participantIds: string[],
    splits: Record<string, number>
  ): SplitCalculation {
    const result: SplitCalculation = {};
    let totalPercentage = 0;

    // Verify all participants have percentages specified
    for (const userId of participantIds) {
      if (!(userId in splits)) {
        throw new ExpenseSplitException(`Percentage not specified for participant ${userId}`);
      }

      const percentage = splits[userId];
      if (percentage < 0 || percentage > 100) {
        throw new ExpenseSplitException(
          `Percentage must be between 0 and 100 for ${userId}, got ${percentage}`
        );
      }

      totalPercentage += percentage;
    }

    // Verify percentages sum to 100
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new ExpenseSplitException(
        `Split percentages sum to ${totalPercentage}%, but must equal 100%`,
        { totalPercentage }
      );
    }

    // Calculate amounts
    let totalDistributed = 0;
    const userIds = Object.keys(splits);

    for (let i = 0; i < userIds.length - 1; i++) {
      const userId = userIds[i];
      const amount = Math.round((totalAmount * splits[userId]) / 100 * 100) / 100;
      result[userId] = amount;
      totalDistributed += amount;
    }

    // Last participant gets remainder
    const lastUserId = userIds[userIds.length - 1];
    result[lastUserId] = Math.round((totalAmount - totalDistributed) * 100) / 100;

    return result;
  }

  /**
   * Calculates split based on itemized expenses
   *
   * @private
   * @param totalAmount - Total expense amount
   * @param participantIds - List of participant IDs
   * @param items - Array of items with amounts and claimedByUserId
   * @returns Split calculation
   * @throws {ExpenseSplitException} If items don't sum to total or invalid configuration
   */
  private calculateItemizedSplit(
    totalAmount: number,
    participantIds: string[],
    items: Array<{ name: string; amount: number; claimedByUserId: string }>
  ): SplitCalculation {
    if (!items || items.length === 0) {
      throw new ExpenseSplitException("At least one item required for itemized split");
    }

    const result: SplitCalculation = {};
    let itemTotal = 0;

    // Initialize all participants
    for (const userId of participantIds) {
      result[userId] = 0;
    }

    // Sum up items for each participant
    for (const item of items) {
      if (!participantIds.includes(item.claimedByUserId)) {
        throw new ExpenseSplitException(
          `Item "${item.name}" assigned to non-participant: ${item.claimedByUserId}`
        );
      }

      if (item.amount < 0) {
        throw new ExpenseSplitException(`Negative item amount not allowed: ${item.name}`);
      }

      result[item.claimedByUserId] += item.amount;
      itemTotal += item.amount;
    }

    // Verify items sum to total
    if (Math.abs(itemTotal - totalAmount) > 0.01) {
      throw new ExpenseSplitException(
        `Item amounts sum to ${itemTotal}, but total is ${totalAmount}`,
        { itemTotal, totalAmount }
      );
    }

    return result;
  }

  /**
   * Validates a split configuration
   *
   * @param totalAmount - Total expense amount
   * @param participantIds - Participant IDs
   * @param splitConfig - Split configuration to validate
   * @throws {ExpenseSplitException} If configuration is invalid
   */
  validateSplitConfig(
    totalAmount: number,
    participantIds: string[],
    splitConfig?: SplitConfig
  ): void {
    if (!splitConfig) {
      return; // No config to validate for EQUAL split
    }

    try {
      this.calculateSplit(totalAmount, splitConfig.type, participantIds, splitConfig);
    } catch (error) {
      // Re-throw split exceptions as-is
      if (error instanceof ExpenseSplitException) {
        throw error;
      }
      throw new ExpenseSplitException(`Split validation failed: ${error}`);
    }
  }
}
