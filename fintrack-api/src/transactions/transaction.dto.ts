/**
 * Transaction Module - Data Transfer Objects (DTOs)
 *
 * DTOs define the contract between layers and with external clients.
 * Separate DTOs are used for:
 * - Input validation (CreateTransactionRequest)
 * - Service operations (Transaction domain model)
 * - HTTP responses (TransactionResponse)
 *
 * @module transactions/dto
 */

import { TransactionTypeEnum, TransactionStatusEnum, PaginationMeta } from "./transaction.types";

/**
 * Request DTO - used by controller to validate incoming HTTP requests
 */
export interface CreateTransactionRequest {
  amount: number;
  type: TransactionTypeEnum;
  description?: string;
}

/**
 * Domain DTO - internal representation used by service layer
 */
export interface CreateTransactionInput {
  userId: string;
  amount: number;
  type: TransactionTypeEnum;
  description?: string;
}

/**
 * Response DTO - returned to HTTP clients
 * Does NOT expose internal details like status or timestamps
 */
export interface TransactionResponse {
  id: string;
  amount: number;
  type: TransactionTypeEnum;
  description?: string;
  status: TransactionStatusEnum;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedTransactionResponse {
  success: boolean;
  data: TransactionResponse[];
  pagination: PaginationMeta;
  message?: string;
}

/**
 * Single transaction response wrapper
 */
export interface SingleTransactionResponse {
  success: boolean;
  data: TransactionResponse;
  message?: string;
}

/**
 * Delete operation response
 */
export interface DeleteTransactionResponse {
  success: boolean;
  deletedCount: number;
  message: string;
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
