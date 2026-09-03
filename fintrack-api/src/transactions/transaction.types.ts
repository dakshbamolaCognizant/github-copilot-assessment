/**
 * Transaction Module - Type Definitions and Enums
 *
 * This file defines all enums and type definitions used across the transaction module.
 * These types are domain-agnostic and should not depend on ORM-specific types.
 *
 * @module transactions/types
 */

/**
 * Transaction type enum - represents the nature of the transaction
 */
export enum TransactionTypeEnum {
  TRANSFER = "TRANSFER",
  DEPOSIT = "DEPOSIT",
  WITHDRAWAL = "WITHDRAWAL",
  PAYMENT = "PAYMENT",
}

/**
 * Transaction status enum - represents the lifecycle state of a transaction
 */
export enum TransactionStatusEnum {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

/**
 * Pagination request parameters
 */
export interface PaginationRequest {
  limit?: number;
  offset?: number;
}

/**
 * Pagination metadata for responses
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Request context - passed through middleware to service
 * Contains authentication and request tracking information
 */
export interface RequestContext {
  requestId: string;
  authenticatedUserId: string;
  timestamp: Date;
}
