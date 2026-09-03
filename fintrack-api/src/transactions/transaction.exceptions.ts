/**
 * Transaction Module - Custom Exceptions
 *
 * Defines domain-specific exceptions for the transaction module.
 * These exceptions are used throughout the service layer for error handling.
 *
 * @module transactions/exceptions
 */

/**
 * Base exception for all transaction-related errors
 */
export class TransactionException extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "TransactionException";
    Object.setPrototypeOf(this, TransactionException.prototype);
  }
}

/**
 * Thrown when transaction validation fails
 */
export class TransactionValidationException extends TransactionException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "TRANSACTION_VALIDATION_ERROR", 400, details);
    this.name = "TransactionValidationException";
    Object.setPrototypeOf(this, TransactionValidationException.prototype);
  }
}

/**
 * Thrown when user is not authorized to access a transaction
 */
export class TransactionUnauthorizedException extends TransactionException {
  constructor(message: string = "Unauthorized access to transaction") {
    super(message, "TRANSACTION_UNAUTHORIZED", 403);
    this.name = "TransactionUnauthorizedException";
    Object.setPrototypeOf(this, TransactionUnauthorizedException.prototype);
  }
}

/**
 * Thrown when a transaction is not found
 */
export class TransactionNotFoundException extends TransactionException {
  constructor(transactionId: string) {
    super(
      `Transaction with ID ${transactionId} not found`,
      "TRANSACTION_NOT_FOUND",
      404
    );
    this.name = "TransactionNotFoundException";
    Object.setPrototypeOf(this, TransactionNotFoundException.prototype);
  }
}

/**
 * Thrown when insufficient funds for a transaction
 */
export class InsufficientFundsException extends TransactionException {
  constructor(required: number, available: number) {
    super(
      `Insufficient funds. Required: ${required}, Available: ${available}`,
      "INSUFFICIENT_FUNDS",
      400,
      { required, available }
    );
    this.name = "InsufficientFundsException";
    Object.setPrototypeOf(this, InsufficientFundsException.prototype);
  }
}

/**
 * Thrown when a transaction operation fails in the database
 */
export class TransactionDatabaseException extends TransactionException {
  constructor(operation: string, originalError: Error) {
    super(
      `Database error during ${operation}`,
      "TRANSACTION_DB_ERROR",
      500,
      { operation, originalError: originalError.message }
    );
    this.name = "TransactionDatabaseException";
    Object.setPrototypeOf(this, TransactionDatabaseException.prototype);
  }
}
