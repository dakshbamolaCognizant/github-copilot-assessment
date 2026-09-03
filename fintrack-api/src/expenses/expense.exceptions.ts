/**
 * Shared Expense Module - Custom Exceptions
 *
 * Domain-specific exceptions for shared expense operations
 *
 * @module expenses/exceptions
 */

/**
 * Base exception for shared expense errors
 */
export class SharedExpenseException extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "SharedExpenseException";
    Object.setPrototypeOf(this, SharedExpenseException.prototype);
  }
}

/**
 * Thrown when expense validation fails
 */
export class ExpenseValidationException extends SharedExpenseException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "EXPENSE_VALIDATION_ERROR", 400, details);
    this.name = "ExpenseValidationException";
    Object.setPrototypeOf(this, ExpenseValidationException.prototype);
  }
}

/**
 * Thrown when user lacks permission to perform operation
 */
export class ExpenseUnauthorizedException extends SharedExpenseException {
  constructor(message: string = "Unauthorized access to expense") {
    super(message, "EXPENSE_UNAUTHORIZED", 403);
    this.name = "ExpenseUnauthorizedException";
    Object.setPrototypeOf(this, ExpenseUnauthorizedException.prototype);
  }
}

/**
 * Thrown when expense not found
 */
export class ExpenseNotFoundException extends SharedExpenseException {
  constructor(expenseId: string) {
    super(
      `Shared expense with ID ${expenseId} not found`,
      "EXPENSE_NOT_FOUND",
      404
    );
    this.name = "ExpenseNotFoundException";
    Object.setPrototypeOf(this, ExpenseNotFoundException.prototype);
  }
}

/**
 * Thrown when expense split calculation fails
 */
export class ExpenseSplitException extends SharedExpenseException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "EXPENSE_SPLIT_ERROR", 400, details);
    this.name = "ExpenseSplitException";
    Object.setPrototypeOf(this, ExpenseSplitException.prototype);
  }
}

/**
 * Thrown when participant doesn't exist for expense
 */
export class ParticipantNotFoundException extends SharedExpenseException {
  constructor(userId: string, expenseId: string) {
    super(
      `User ${userId} is not a participant in expense ${expenseId}`,
      "PARTICIPANT_NOT_FOUND",
      404
    );
    this.name = "ParticipantNotFoundException";
    Object.setPrototypeOf(this, ParticipantNotFoundException.prototype);
  }
}

/**
 * Thrown when settlement operation fails
 */
export class SettlementException extends SharedExpenseException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "SETTLEMENT_ERROR", 400, details);
    this.name = "SettlementException";
    Object.setPrototypeOf(this, SettlementException.prototype);
  }
}

/**
 * Thrown when database operation fails
 */
export class ExpenseDatabaseException extends SharedExpenseException {
  constructor(operation: string, originalError: Error) {
    super(
      `Database error during ${operation}`,
      "EXPENSE_DB_ERROR",
      500,
      { operation, originalError: originalError.message }
    );
    this.name = "ExpenseDatabaseException";
    Object.setPrototypeOf(this, ExpenseDatabaseException.prototype);
  }
}
