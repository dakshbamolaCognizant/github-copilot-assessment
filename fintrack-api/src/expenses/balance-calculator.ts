/**
 * Balance Calculation Algorithm for Expense Splitting
 *
 * This module implements sophisticated algorithms for:
 * 1. Calculating individual shares based on split type
 * 2. Tracking who owes whom
 * 3. Managing settlement payments
 * 4. Computing final balances
 * 5. Handling rounding and precision
 *
 * @module expenses/balance-calculator
 */

import { Decimal } from "@prisma/client/runtime/library";
import { ExpenseSplitTypeEnum, ParticipantBalance } from "./expense.types";
import { ExpenseSplitException } from "./expense.exceptions";

/**
 * Individual share information
 */
export interface Share {
  userId: string;
  amount: number;
  percentage?: number;
}

/**
 * Balance owed by one person to another
 */
export interface Balance {
  userId: string;
  balance: number; // Negative = owes money, Positive = owed money
  owedAmount: number;
  paidAmount: number;
}

/**
 * Settlement transaction
 */
export interface SettlementTransaction {
  from: string; // Who pays
  to: string;   // Who receives
  amount: number;
}

/**
 * Expense with participants and payments
 */
export interface ExpenseRecord {
  id: string;
  creatorId: string;
  totalAmount: number;
  participants: ParticipantRecord[];
  settlements: SettlementPayment[];
}

/**
 * Participant in an expense
 */
export interface ParticipantRecord {
  userId: string;
  owedAmount: number;
  paidAmount: number;
}

/**
 * Settlement payment record
 */
export interface SettlementPayment {
  paidByUserId: string;
  paidToUserId: string;
  amount: number;
  date: Date;
}

/**
 * Balance Calculator - Comprehensive expense splitting and balance tracking
 */
export class BalanceCalculator {
  /**
   * ALGORITHM 1: Calculate Individual Shares
   *
   * Takes a total expense amount and participant list, calculates
   * what each person owes based on the split type.
   *
   * Time Complexity: O(n) where n = number of participants
   * Space Complexity: O(n)
   *
   * @param totalAmount - Total expense amount
   * @param participantIds - Array of user IDs
   * @param splitType - Type of split
   * @param splitConfig - Configuration specific to split type
   * @returns Map of userId to share amount
   */
  calculateShares(
    totalAmount: number,
    participantIds: string[],
    splitType: ExpenseSplitTypeEnum,
    splitConfig?: Record<string, any>
  ): Record<string, number> {
    this.validateInput(totalAmount, participantIds);

    switch (splitType) {
      case ExpenseSplitTypeEnum.EQUAL:
        return this.calculateEqualShares(totalAmount, participantIds);

      case ExpenseSplitTypeEnum.BY_AMOUNT:
        return this.calculateAmountShares(
          totalAmount,
          participantIds,
          splitConfig?.splits || {}
        );

      case ExpenseSplitTypeEnum.BY_PERCENTAGE:
        return this.calculatePercentageShares(
          totalAmount,
          participantIds,
          splitConfig?.splits || {}
        );

      case ExpenseSplitTypeEnum.ITEMIZED:
        return this.calculateItemizedShares(
          totalAmount,
          participantIds,
          splitConfig?.items || []
        );

      default:
        throw new ExpenseSplitException(`Unknown split type: ${splitType}`);
    }
  }

  /**
   * ALGORITHM 2: Equal Split Calculation
   *
   * Divides the total amount equally among all participants.
   * Handles rounding by distributing remainder to last participant.
   *
   * Example: $100 / 3 people
   *   Person 1: $33.33
   *   Person 2: $33.33
   *   Person 3: $33.34 (gets remainder)
   *
   * @private
   */
  private calculateEqualShares(
    totalAmount: number,
    participantIds: string[]
  ): Record<string, number> {
    const shares: Record<string, number> = {};

    // Calculate per-person amount (rounded down)
    const perPersonAmount = Math.floor(totalAmount * 100) / 100 / participantIds.length;

    let totalDistributed = 0;

    // Distribute equal shares (rounded to 2 decimals)
    for (let i = 0; i < participantIds.length - 1; i++) {
      const roundedAmount = Math.round(perPersonAmount * 100) / 100;
      shares[participantIds[i]] = roundedAmount;
      totalDistributed += roundedAmount;
    }

    // Last person gets remainder to ensure total matches exactly
    shares[participantIds[participantIds.length - 1]] = 
      Math.round((totalAmount - totalDistributed) * 100) / 100;

    this.validateSharesSum(shares, totalAmount);
    return shares;
  }

  /**
   * ALGORITHM 3: Custom Amount Split
   *
   * Each participant is assigned a specific dollar amount.
   * Must sum to the total expense.
   *
   * Example: $100 bill
   *   Alice: $40
   *   Bob: $35
   *   Charlie: $25
   *
   * @private
   */
  private calculateAmountShares(
    totalAmount: number,
    participantIds: string[],
    splits: Record<string, number>
  ): Record<string, number> {
    const shares: Record<string, number> = {};
    let sum = 0;

    // Validate all participants have amounts
    for (const userId of participantIds) {
      if (!(userId in splits)) {
        throw new ExpenseSplitException(
          `No amount specified for participant: ${userId}`,
          { participantId: userId, type: "MISSING_AMOUNT" }
        );
      }

      const amount = splits[userId];

      if (amount < 0) {
        throw new ExpenseSplitException(
          `Negative amount not allowed: ${userId} -> $${amount}`,
          { userId, amount, type: "NEGATIVE_AMOUNT" }
        );
      }

      shares[userId] = Math.round(amount * 100) / 100;
      sum += shares[userId];
    }

    // Verify sum matches total (allow small rounding tolerance)
    if (Math.abs(sum - totalAmount) > 0.01) {
      throw new ExpenseSplitException(
        `Split amounts ($${sum}) don't match total ($${totalAmount})`,
        { expectedTotal: totalAmount, actualSum: sum, difference: totalAmount - sum }
      );
    }

    return shares;
  }

  /**
   * ALGORITHM 4: Percentage-Based Split
   *
   * Each participant pays a percentage of the total.
   * Percentages must sum to 100.
   *
   * Example: $100 bill with percentages
   *   Alice: 50% = $50
   *   Bob: 30% = $30
   *   Charlie: 20% = $20
   *
   * @private
   */
  private calculatePercentageShares(
    totalAmount: number,
    participantIds: string[],
    splits: Record<string, number>
  ): Record<string, number> {
    const shares: Record<string, number> = {};
    let totalPercentage = 0;

    // Validate all participants have percentages
    for (const userId of participantIds) {
      if (!(userId in splits)) {
        throw new ExpenseSplitException(
          `No percentage specified for participant: ${userId}`,
          { participantId: userId, type: "MISSING_PERCENTAGE" }
        );
      }

      const percentage = splits[userId];

      if (percentage < 0 || percentage > 100) {
        throw new ExpenseSplitException(
          `Percentage must be 0-100 for ${userId}, got ${percentage}`,
          { userId, percentage, type: "INVALID_PERCENTAGE" }
        );
      }

      totalPercentage += percentage;
    }

    // Verify percentages sum to 100
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new ExpenseSplitException(
        `Percentages sum to ${totalPercentage}%, but must equal 100%`,
        { totalPercentage, type: "INVALID_PERCENTAGE_SUM" }
      );
    }

    // Calculate dollar amounts
    let totalDistributed = 0;
    const userIds = Object.keys(splits).sort();

    for (let i = 0; i < userIds.length - 1; i++) {
      const userId = userIds[i];
      const amount = Math.round((totalAmount * splits[userId]) / 100 * 100) / 100;
      shares[userId] = amount;
      totalDistributed += amount;
    }

    // Last person gets remainder
    const lastUserId = userIds[userIds.length - 1];
    shares[lastUserId] = Math.round((totalAmount - totalDistributed) * 100) / 100;

    this.validateSharesSum(shares, totalAmount);
    return shares;
  }

  /**
   * ALGORITHM 5: Itemized Split
   *
   * Each item is assigned to a participant.
   * Each person owes for the items they claimed.
   *
   * Example: Restaurant bill $120
   *   Items:
   *     - Steak ($35) -> Alice
   *     - Fish ($32) -> Bob
   *     - Pasta ($28) -> Charlie
   *     - Salad ($25) -> Diana
   *
   * @private
   */
  private calculateItemizedShares(
    totalAmount: number,
    participantIds: string[],
    items: Array<{ name: string; amount: number; claimedByUserId: string }>
  ): Record<string, number> {
    if (!items || items.length === 0) {
      throw new ExpenseSplitException(
        "At least one item required for itemized split",
        { type: "NO_ITEMS" }
      );
    }

    const shares: Record<string, number> = {};
    let itemSum = 0;

    // Initialize all participants to 0
    for (const userId of participantIds) {
      shares[userId] = 0;
    }

    // Aggregate items by claimant
    for (const item of items) {
      if (!participantIds.includes(item.claimedByUserId)) {
        throw new ExpenseSplitException(
          `Item "${item.name}" assigned to non-participant: ${item.claimedByUserId}`,
          { itemName: item.name, userId: item.claimedByUserId, type: "INVALID_CLAIMANT" }
        );
      }

      if (item.amount < 0) {
        throw new ExpenseSplitException(
          `Negative item amount not allowed: "${item.name}" ($${item.amount})`,
          { itemName: item.name, amount: item.amount, type: "NEGATIVE_ITEM_AMOUNT" }
        );
      }

      shares[item.claimedByUserId] += item.amount;
      itemSum += item.amount;
    }

    // Round all amounts to 2 decimals
    for (const userId in shares) {
      shares[userId] = Math.round(shares[userId] * 100) / 100;
    }

    // Verify items sum to total
    if (Math.abs(itemSum - totalAmount) > 0.01) {
      throw new ExpenseSplitException(
        `Item amounts ($${itemSum}) don't match total ($${totalAmount})`,
        { itemSum, totalAmount, difference: totalAmount - itemSum, type: "ITEM_SUM_MISMATCH" }
      );
    }

    return shares;
  }

  /**
   * ALGORITHM 6: Calculate Current Balances
   *
   * Determines for each participant:
   * - How much they owe
   * - How much they've paid
   * - Their current balance (remaining debt)
   *
   * Time Complexity: O(n) where n = number of participants
   * Space Complexity: O(n)
   *
   * @param expense - Expense record with participants and settlements
   * @returns Array of balances for each participant
   */
  calculateBalances(expense: ExpenseRecord): Balance[] {
    const balances: Record<string, Balance> = {};

    // Initialize balances from participants
    for (const participant of expense.participants) {
      balances[participant.userId] = {
        userId: participant.userId,
        balance: 0,
        owedAmount: participant.owedAmount,
        paidAmount: participant.paidAmount,
      };
    }

    // Calculate balance (owed - paid)
    for (const userId in balances) {
      balances[userId].balance = 
        balances[userId].owedAmount - balances[userId].paidAmount;
    }

    return Object.values(balances);
  }

  /**
   * ALGORITHM 7: Calculate Optimal Settlement Path
   *
   * Given an expense with multiple participants, determines the minimum
   * number of payments to settle all debts.
   *
   * This solves the "friend group settlement" problem:
   * If Alice owes $30, Bob owes $20, and Charlie is owed $50,
   * we need to find the minimum transfers.
   *
   * Algorithm:
   * 1. Calculate net balance for each person
   * 2. Separate into debtors (negative balance) and creditors (positive balance)
   * 3. Match largest debtor with largest creditor
   * 4. Create payment and reduce both balances
   * 5. Repeat until all settled
   *
   * Time Complexity: O(n²) worst case
   * Space Complexity: O(n)
   *
   * @param expense - Expense record
   * @returns Optimal settlement transactions
   */
  calculateOptimalSettlements(expense: ExpenseRecord): SettlementTransaction[] {
    // Calculate net balances
    const balances = this.calculateBalances(expense);

    // Separate into debtors and creditors
    const debtors = balances
      .filter(b => b.balance > 0) // Balance > 0 means they're owed money
      .map(b => ({ userId: b.userId, amount: b.balance }))
      .sort((a, b) => b.amount - a.amount); // Sort descending by amount

    const creditors = balances
      .filter(b => b.balance < 0) // Balance < 0 means they owe money
      .map(b => ({ userId: b.userId, amount: Math.abs(b.balance) }))
      .sort((a, b) => b.amount - a.amount); // Sort descending by amount

    const settlements: SettlementTransaction[] = [];

    // Match debtors with creditors
    let debtorIdx = 0;
    let creditorIdx = 0;

    while (debtorIdx < debtors.length && creditorIdx < creditors.length) {
      const debtor = debtors[debtorIdx];
      const creditor = creditors[creditorIdx];

      // Amount to transfer (minimum of the two)
      const amount = Math.min(debtor.amount, creditor.amount);

      settlements.push({
        from: creditor.userId, // Creditor pays debtor
        to: debtor.userId,
        amount: Math.round(amount * 100) / 100,
      });

      // Update remaining balances
      debtor.amount -= amount;
      creditor.amount -= amount;

      // Move to next if current is settled
      if (debtor.amount === 0) debtorIdx++;
      if (creditor.amount === 0) creditorIdx++;
    }

    return settlements;
  }

  /**
   * ALGORITHM 8: Validate Settlement Transactions
   *
   * Checks if a set of settlement transactions would settle all debts.
   *
   * @param expense - Expense record
   * @param settlements - Proposed settlement transactions
   * @returns true if settlements are sufficient
   */
  validateSettlements(
    expense: ExpenseRecord,
    settlements: SettlementTransaction[]
  ): boolean {
    const balances = this.calculateBalances(expense);
    const balanceMap: Record<string, number> = {};

    // Initialize with current balances
    for (const balance of balances) {
      balanceMap[balance.userId] = balance.balance;
    }

    // Apply settlements
    for (const settlement of settlements) {
      if (!(settlement.from in balanceMap)) {
        throw new ExpenseSplitException(
          `Settlement references unknown participant: ${settlement.from}`,
          { userId: settlement.from }
        );
      }

      if (!(settlement.to in balanceMap)) {
        throw new ExpenseSplitException(
          `Settlement references unknown participant: ${settlement.to}`,
          { userId: settlement.to }
        );
      }

      // Debtor (from) pays, reducing their debt
      balanceMap[settlement.from] -= settlement.amount;

      // Creditor (to) receives, reducing amount owed to them
      balanceMap[settlement.to] -= settlement.amount;
    }

    // All balances should be ~0
    for (const userId in balanceMap) {
      if (Math.abs(balanceMap[userId]) > 0.01) {
        return false; // Settlements don't fully settle
      }
    }

    return true;
  }

  /**
   * ALGORITHM 9: Calculate Participant Summary
   *
   * Returns a comprehensive summary for each participant:
   * - Their share of the expense
   * - How much they've paid
   * - Current balance
   * - Settlement status
   *
   * @param expense - Expense record
   * @returns Summary for each participant
   */
  calculateParticipantSummary(
    expense: ExpenseRecord
  ): Array<{
    userId: string;
    owedAmount: number;
    paidAmount: number;
    balanceRemaining: number;
    status: "SETTLED" | "PARTIALLY_PAID" | "PENDING";
  }> {
    const balances = this.calculateBalances(expense);

    return balances.map(balance => {
      let status: "SETTLED" | "PARTIALLY_PAID" | "PENDING" = "PENDING";

      if (Math.abs(balance.balance) < 0.01) {
        status = "SETTLED";
      } else if (balance.paidAmount > 0) {
        status = "PARTIALLY_PAID";
      }

      return {
        userId: balance.userId,
        owedAmount: Math.round(balance.owedAmount * 100) / 100,
        paidAmount: Math.round(balance.paidAmount * 100) / 100,
        balanceRemaining: Math.round(balance.balance * 100) / 100,
        status,
      };
    });
  }

  /**
   * ALGORITHM 10: Payment Application
   *
   * When a participant makes a payment, apply it to their debt.
   * Validate that:
   * - Payment doesn't exceed owed amount
   * - Payment is positive
   *
   * @param balance - Current balance record
   * @param paymentAmount - Amount being paid
   * @returns Updated balance
   */
  applyPayment(balance: Balance, paymentAmount: number): Balance {
    if (paymentAmount <= 0) {
      throw new ExpenseSplitException(
        `Payment amount must be positive, got $${paymentAmount}`,
        { amount: paymentAmount, type: "INVALID_PAYMENT_AMOUNT" }
      );
    }

    const newPaidAmount = balance.paidAmount + paymentAmount;

    if (newPaidAmount > balance.owedAmount + 0.01) {
      throw new ExpenseSplitException(
        `Payment ($${paymentAmount}) exceeds remaining debt ($${balance.owedAmount - balance.paidAmount})`,
        {
          paymentAmount,
          remainingDebt: balance.owedAmount - balance.paidAmount,
          type: "OVERPAYMENT",
        }
      );
    }

    return {
      ...balance,
      paidAmount: Math.round(newPaidAmount * 100) / 100,
      balance: Math.round((balance.owedAmount - newPaidAmount) * 100) / 100,
    };
  }

  /**
   * ALGORITHM 11: Reconciliation Check
   *
   * Verifies that all expenses and payments are consistent.
   * Total owed should equal total amount.
   * Total paid by all should match payments recorded.
   *
   * @param expense - Expense record to verify
   * @throws {ExpenseSplitException} If reconciliation fails
   */
  reconcile(expense: ExpenseRecord): void {
    // Total owed by all participants
    const totalOwed = expense.participants.reduce(
      (sum, p) => sum + p.owedAmount,
      0
    );

    // Verify total owed matches expense amount (within tolerance)
    if (Math.abs(totalOwed - expense.totalAmount) > 0.01) {
      throw new ExpenseSplitException(
        `Total owed ($${totalOwed}) doesn't match expense ($${expense.totalAmount})`,
        { totalOwed, totalExpense: expense.totalAmount }
      );
    }

    // Total paid by all
    const totalPaid = expense.participants.reduce(
      (sum, p) => sum + p.paidAmount,
      0
    );

    // Verify settlements match total paid
    const settlementTotal = expense.settlements.reduce(
      (sum, s) => sum + s.amount,
      0
    );

    if (Math.abs(totalPaid - settlementTotal) > 0.01) {
      throw new ExpenseSplitException(
        `Total paid ($${totalPaid}) doesn't match settlements ($${settlementTotal})`,
        { totalPaid, totalSettlements: settlementTotal }
      );
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Validates input parameters
   * @private
   */
  private validateInput(totalAmount: number, participantIds: string[]): void {
    if (totalAmount <= 0) {
      throw new ExpenseSplitException(
        `Total amount must be positive, got $${totalAmount}`,
        { amount: totalAmount, type: "INVALID_AMOUNT" }
      );
    }

    if (!participantIds || participantIds.length === 0) {
      throw new ExpenseSplitException(
        "At least one participant required",
        { type: "NO_PARTICIPANTS" }
      );
    }

    // Check for duplicates
    const uniqueIds = new Set(participantIds);
    if (uniqueIds.size !== participantIds.length) {
      throw new ExpenseSplitException(
        "Duplicate participant IDs not allowed",
        { type: "DUPLICATE_PARTICIPANTS" }
      );
    }
  }

  /**
   * Validates that shares sum to total amount
   * @private
   */
  private validateSharesSum(
    shares: Record<string, number>,
    totalAmount: number
  ): void {
    const sum = Object.values(shares).reduce((a, b) => a + b, 0);

    if (Math.abs(sum - totalAmount) > 0.01) {
      throw new ExpenseSplitException(
        `Shares ($${sum}) don't sum to total ($${totalAmount})`,
        { sharesSum: sum, totalAmount }
      );
    }
  }
}

/**
 * Export convenience functions for common operations
 */

export function createBalanceCalculator(): BalanceCalculator {
  return new BalanceCalculator();
}

/**
 * Quick calculation functions
 */

export const BalanceCalculatorUtils = {
  /**
   * Quick equal split
   */
  equalSplit(totalAmount: number, participantCount: number): Record<string, number> {
    const perPerson = Math.round(totalAmount / participantCount * 100) / 100;
    const remainder = totalAmount - perPerson * (participantCount - 1);

    const shares: Record<string, number> = {};
    for (let i = 0; i < participantCount; 1) {
      if (i < participantCount - 1) {
        shares[`user_${i}`] = perPerson;
      } else {
        shares[`user_${i}`] = Math.round(remainder * 100) / 100;
      }
      i++;
    }
    return shares;
  },

  /**
   * Quick percentage calculation
   */
  percentageOf(amount: number, percentage: number): number {
    return Math.round(amount * percentage / 100 * 100) / 100;
  },

  /**
   * Quick validation that amounts sum correctly
   */
  validateSum(amounts: number[], expectedTotal: number): boolean {
    const sum = Math.round(
      amounts.reduce((a, b) => a + b, 0) * 100
    ) / 100;
    return Math.abs(sum - expectedTotal) <= 0.01;
  },
};
