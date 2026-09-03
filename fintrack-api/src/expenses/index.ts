/**
 * Shared Expense Module - Barrel Export
 *
 * Centralizes all exports from the shared expense module for convenient importing.
 *
 * Usage:
 * ```typescript
 * import {
 *   SharedExpenseService,
 *   SharedExpenseController,
 *   createSharedExpenseRoutes,
 *   ExpenseSplitTypeEnum
 * } from './expenses';
 * ```
 *
 * @module expenses/index
 */

// Service & Repository
export { SharedExpenseService } from "./expense.service";
export { SharedExpenseRepository } from "./expense.model";

// Controller
export { SharedExpenseController } from "./expense.controller";

// Routes
export { createSharedExpenseRoutes } from "./expense.routes";

// Types & Enums
export {
  ExpenseSplitTypeEnum,
  SettlementStatusEnum,
  PaymentMethodEnum,
  ExpenseCategoryEnum,
  type RequestContext,
  type SplitConfig,
  type ParticipantBalance,
  type SettlementSummary,
} from "./expense.types";

// DTOs
export {
  type CreateSharedExpenseRequest,
  type UpdateSharedExpenseRequest,
  type CreateSharedExpenseInput,
  type ParticipantDTO,
  type SharedExpenseResponse,
  type PaginatedSharedExpenseResponse,
  type RecordSettlementRequest,
  type SettlementSummaryResponse,
} from "./expense.dto";

// Exceptions
export {
  SharedExpenseException,
  ExpenseValidationException,
  ExpenseUnauthorizedException,
  ExpenseNotFoundException,
  ExpenseSplitException,
  ParticipantNotFoundException,
  SettlementException,
  ExpenseDatabaseException,
} from "./expense.exceptions";

// Balance Calculator
export {
  BalanceCalculator,
  createBalanceCalculator,
  type Balance,
  type SettlementTransaction,
  type ExpenseRecord,
  type ParticipantRecord,
  type SettlementPayment,
  type Share,
} from "./balance-calculator";

// Validator
export { ExpenseValidator } from "./expense.validator";
