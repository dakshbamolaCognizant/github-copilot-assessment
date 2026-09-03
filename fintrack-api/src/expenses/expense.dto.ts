/**
 * Shared Expense Module - Data Transfer Objects (DTOs)
 *
 * DTOs define contracts between layers (HTTP, Service, Repository)
 *
 * @module expenses/dto
 */

import { ExpenseSplitTypeEnum, SettlementStatusEnum, PaymentMethodEnum, ExpenseCategoryEnum, SplitConfig } from "./expense.types";

/**
 * Request DTO - HTTP input for creating shared expense
 */
export interface CreateSharedExpenseRequest {
  description: string;
  totalAmount: number;
  splitType: ExpenseSplitTypeEnum;
  participantIds: string[]; // Array of user IDs to include
  splitConfig?: SplitConfig; // Optional, depends on splitType
  category?: ExpenseCategoryEnum;
  notes?: string;
  expenseDate?: Date;
}

/**
 * Request DTO - HTTP input for updating shared expense
 */
export interface UpdateSharedExpenseRequest {
  description?: string;
  category?: ExpenseCategoryEnum;
  notes?: string;
  expenseDate?: Date;
}

/**
 * Domain DTO - Service layer input
 */
export interface CreateSharedExpenseInput {
  creatorId: string;
  description: string;
  totalAmount: number;
  splitType: ExpenseSplitTypeEnum;
  participantIds: string[];
  splitConfig?: SplitConfig;
  category?: ExpenseCategoryEnum;
  notes?: string;
  expenseDate?: Date;
}

/**
 * Participant info DTO - returned in response
 */
export interface ParticipantDTO {
  userId: string;
  owedAmount: number;
  paidAmount: number;
  balanceRemaining: number;
}

/**
 * Response DTO - HTTP output for shared expense
 */
export interface SharedExpenseResponse {
  id: string;
  creatorId: string;
  description: string;
  totalAmount: number;
  splitType: ExpenseSplitTypeEnum;
  status: SettlementStatusEnum;
  category?: string;
  notes?: string;
  expenseDate: Date;
  participants: ParticipantDTO[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedSharedExpenseResponse {
  success: boolean;
  data: SharedExpenseResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Settlement record DTO
 */
export interface SettlementRecordDTO {
  id: string;
  expenseId: string;
  paidByUserId: string;
  paidToUserId: string;
  amount: number;
  paymentMethod: PaymentMethodEnum;
  transactionReference?: string;
  settledAt: Date;
}

/**
 * Settlement request DTO - for recording a payment
 */
export interface RecordSettlementRequest {
  paidByUserId: string;
  paidToUserId: string;
  amount: number;
  paymentMethod: PaymentMethodEnum;
  transactionReference?: string;
}

/**
 * Settlement summary DTO
 */
export interface SettlementSummaryResponse {
  expenseId: string;
  totalAmount: number;
  totalPaid: number;
  amountRemaining: number;
  status: SettlementStatusEnum;
  participants: ParticipantDTO[];
  settlements: SettlementRecordDTO[];
}

/**
 * Error response wrapper
 */
export interface ErrorResponse {
  success: false;
  message: string;
  code: string;
  details?: Record<string, unknown>;
}
