/**
 * Transaction Module - Index (Barrel Export)
 *
 * Centralizes all exports from the transaction module for cleaner imports.
 * This allows consumers to import from the module root instead of individual files.
 *
 * @module transactions
 *
 * @example
 * // Instead of:
 * import { TransactionService } from './transactions/transaction.service';
 * import { TransactionController } from './transactions/transaction.controller';
 * import { TransactionRepository } from './transactions/transaction.repository';
 *
 * // Use:
 * import {
 *   TransactionService,
 *   TransactionController,
 *   TransactionRepository,
 * } from './transactions';
 */

// Controllers
export { TransactionController } from "./transaction.controller";

// Services
export { TransactionService } from "./transaction.service";

// Repositories
export {
  TransactionRepository,
  type ITransactionRepository,
} from "./transaction.repository";

// Validators
export { TransactionValidator } from "./transaction.validator";

// Routes
export { createTransactionRoutes } from "./transaction.routes";

// DTOs
export type {
  CreateTransactionRequest,
  CreateTransactionInput,
  TransactionResponse,
  PaginatedTransactionResponse,
  SingleTransactionResponse,
  DeleteTransactionResponse,
  ErrorResponse,
} from "./transaction.dto";

// Types and Enums
export {
  TransactionTypeEnum,
  TransactionStatusEnum,
  type RequestContext,
  type PaginationRequest,
  type PaginationMeta,
} from "./transaction.types";

// Exceptions
export {
  TransactionException,
  TransactionValidationException,
  TransactionUnauthorizedException,
  TransactionNotFoundException,
  InsufficientFundsException,
  TransactionDatabaseException,
} from "./transaction.exceptions";
