/**
 * Shared Expense Module - Type Definitions and Enums
 *
 * Domain-agnostic type definitions for the shared expense feature.
 *
 * @module expenses/types
 */

/**
 * Split type enum - defines how expense is divided
 */
export enum ExpenseSplitTypeEnum {
  EQUAL = "EQUAL",
  BY_AMOUNT = "BY_AMOUNT",
  BY_PERCENTAGE = "BY_PERCENTAGE",
  ITEMIZED = "ITEMIZED",
}

/**
 * Settlement status enum - tracks payment progress
 */
export enum SettlementStatusEnum {
  PENDING = "PENDING",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  SETTLED = "SETTLED",
  CANCELLED = "CANCELLED",
}

/**
 * Payment method enum
 */
export enum PaymentMethodEnum {
  CASH = "CASH",
  VENMO = "VENMO",
  PAYPAL = "PAYPAL",
  BANK_TRANSFER = "BANK_TRANSFER",
  CARD = "CARD",
  OTHER = "OTHER",
}

/**
 * Expense category enum
 */
export enum ExpenseCategoryEnum {
  FOOD = "FOOD",
  RENT = "RENT",
  UTILITIES = "UTILITIES",
  ENTERTAINMENT = "ENTERTAINMENT",
  TRAVEL = "TRAVEL",
  SUPPLIES = "SUPPLIES",
  MEDICAL = "MEDICAL",
  PERSONAL = "PERSONAL",
  OTHER = "OTHER",
}

/**
 * Participant split configuration for equal split
 */
export interface EqualSplitConfig {
  type: ExpenseSplitTypeEnum.EQUAL;
  participantCount: number;
}

/**
 * Participant split configuration for amount-based split
 */
export interface AmountSplitConfig {
  type: ExpenseSplitTypeEnum.BY_AMOUNT;
  splits: Record<string, number>; // userId -> amount
}

/**
 * Participant split configuration for percentage-based split
 */
export interface PercentageSplitConfig {
  type: ExpenseSplitTypeEnum.BY_PERCENTAGE;
  splits: Record<string, number>; // userId -> percentage (0-100)
}

/**
 * Participant split configuration for itemized split
 */
export interface ItemizedSplitConfig {
  type: ExpenseSplitTypeEnum.ITEMIZED;
  items: Array<{
    name: string;
    amount: number;
    claimedByUserId: string;
  }>;
}

/**
 * Union type for any split configuration
 */
export type SplitConfig = EqualSplitConfig | AmountSplitConfig | PercentageSplitConfig | ItemizedSplitConfig;

/**
 * Participant balance information
 */
export interface ParticipantBalance {
  userId: string;
  owedAmount: number;
  paidAmount: number;
  balanceRemaining: number; // owedAmount - paidAmount
  settlementStatus: "SETTLED" | "PARTIALLY_PAID" | "PENDING";
}

/**
 * Settlement summary for an expense
 */
export interface SettlementSummary {
  expenseId: string;
  totalAmount: number;
  totalPaid: number;
  amountRemaining: number;
  participants: ParticipantBalance[];
  overallStatus: SettlementStatusEnum;
}

/**
 * Request context for audit trail
 */
export interface RequestContext {
  requestId: string;
  authenticatedUserId: string;
  timestamp: Date;
}
