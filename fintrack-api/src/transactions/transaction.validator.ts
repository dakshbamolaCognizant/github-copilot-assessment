/**
 * Transaction Module - Input Validation Layer
 *
 * Validates all incoming request data before processing.
 * This layer ensures data integrity and consistency before business logic execution.
 *
 * @module transactions/validator
 */

import { TransactionValidationException } from "./transaction.exceptions";
import { TransactionTypeEnum } from "./transaction.types";
import { CreateTransactionRequest } from "./transaction.dto";

/**
 * Transaction validator - validates input data against domain rules
 */
export class TransactionValidator {
  private readonly MIN_AMOUNT = 0.01;
  private readonly MAX_AMOUNT = 999_999_999.99;
  private readonly MAX_DESCRIPTION_LENGTH = 500;
  private readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /**
   * Validates a user ID is a valid UUID format
   *
   * @param userId - The user ID to validate
   * @throws {TransactionValidationException} If userId is not a valid UUID
   */
  public validateUserId(userId: string): void {
    if (!userId || typeof userId !== "string") {
      throw new TransactionValidationException("User ID is required and must be a string", {
        field: "userId",
        value: "[REDACTED]",
      });
    }

    if (!this.UUID_REGEX.test(userId)) {
      throw new TransactionValidationException(
        "User ID must be a valid UUID format",
        {
          field: "userId",
          format: "UUID v4",
        }
      );
    }
  }

  /**
   * Validates create transaction request payload
   *
   * @param request - The create transaction request
   * @throws {TransactionValidationException} If validation fails
   */
  public validateCreateTransactionRequest(request: CreateTransactionRequest): void {
    const errors: Record<string, string> = {};

    // Validate amount
    if (request.amount === undefined || request.amount === null) {
      errors.amount = "Amount is required";
    } else if (typeof request.amount !== "number") {
      errors.amount = "Amount must be a number";
    } else if (request.amount < this.MIN_AMOUNT) {
      errors.amount = `Amount must be at least ${this.MIN_AMOUNT}`;
    } else if (request.amount > this.MAX_AMOUNT) {
      errors.amount = `Amount cannot exceed ${this.MAX_AMOUNT}`;
    } else if (!this.isValidDecimal(request.amount)) {
      errors.amount = "Amount must have at most 2 decimal places";
    }

    // Validate type
    if (!request.type) {
      errors.type = "Transaction type is required";
    } else if (!Object.values(TransactionTypeEnum).includes(request.type)) {
      errors.type = `Invalid transaction type. Must be one of: ${Object.values(
        TransactionTypeEnum
      ).join(", ")}`;
    }

    // Validate description
    if (request.description !== undefined && request.description !== null) {
      if (typeof request.description !== "string") {
        errors.description = "Description must be a string";
      } else if (request.description.length > this.MAX_DESCRIPTION_LENGTH) {
        errors.description = `Description cannot exceed ${this.MAX_DESCRIPTION_LENGTH} characters`;
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new TransactionValidationException("Transaction validation failed", errors);
    }
  }

  /**
   * Validates pagination parameters
   *
   * @param limit - The page limit
   * @param offset - The page offset
   * @throws {TransactionValidationException} If pagination is invalid
   */
  public validatePagination(limit?: number, offset?: number): { limit: number; offset: number } {
    const DEFAULT_LIMIT = 100;
    const MAX_LIMIT = 1000;
    const MIN_LIMIT = 1;

    let normalizedLimit = limit ?? DEFAULT_LIMIT;
    let normalizedOffset = offset ?? 0;

    if (typeof normalizedLimit !== "number" || normalizedLimit < MIN_LIMIT) {
      normalizedLimit = DEFAULT_LIMIT;
    }

    if (normalizedLimit > MAX_LIMIT) {
      normalizedLimit = MAX_LIMIT;
    }

    if (typeof normalizedOffset !== "number" || normalizedOffset < 0) {
      normalizedOffset = 0;
    }

    return { limit: normalizedLimit, offset: normalizedOffset };
  }

  /**
   * Checks if a number has valid decimal precision (max 2 decimal places)
   *
   * @private
   * @param value - The number to check
   * @returns true if decimal is valid
   */
  private isValidDecimal(value: number): boolean {
    const decimalPlaces = (value.toString().split(".")[1] || "").length;
    return decimalPlaces <= 2;
  }
}
