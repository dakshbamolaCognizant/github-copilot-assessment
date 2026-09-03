/**
 * Shared Expense Module - Controller Layer (HTTP Request/Response Handling)
 *
 * The controller layer handles:
 * - HTTP request parsing and validation
 * - Calling appropriate service methods
 * - Building HTTP responses with proper status codes
 * - Error handling and error-to-HTTP-status mapping
 * - Request context propagation
 *
 * The controller should NOT contain:
 * - Business logic (belongs in service)
 * - Database queries (belongs in repository)
 * - Low-level validation (belongs in validator)
 * - Authorization checks (belongs in middleware, but service re-checks)
 *
 * @module expenses/controller
 */

import { Request, Response } from "express";
import { SharedExpenseService } from "./expense.service";
import { ExpenseValidator } from "./expense.validator";
import { Logger } from "../logger";
import {
  ExpenseValidationException,
  ExpenseUnauthorizedException,
  ExpenseNotFoundException,
  ExpenseSplitException,
  ExpenseDatabaseException,
} from "./expense.exceptions";
import { RequestContext } from "./expense.types";
import { CreateSharedExpenseRequest, UpdateSharedExpenseRequest, RecordSettlementRequest } from "./expense.dto";

/**
 * Shared Expense Controller - handles HTTP requests for shared expense operations
 */
export class SharedExpenseController {
  /**
   * Creates a new SharedExpenseController instance
   *
   * @param service - Shared expense service for business logic
   * @param validator - Expense validator for input validation
   * @param logger - Logger for structured logging
   */
  constructor(
    private service: SharedExpenseService,
    private validator: ExpenseValidator,
    private logger: Logger
  ) {}

  /**
   * HTTP POST handler - Create a new shared expense
   *
   * Expects JSON request body:
   * ```json
   * {
   *   "description": "Dinner with friends",
   *   "totalAmount": 120.50,
   *   "splitType": "EQUAL",
   *   "participantIds": ["user-123", "user-456", "user-789"],
   *   "category": "DINING",
   *   "notes": "Italian restaurant"
   * }
   * ```
   *
   * Split Type Details:
   * - EQUAL: Divide equally among participants
   * - BY_AMOUNT: Specify exact amount per person
   * - BY_PERCENTAGE: Specify percentage per person
   * - ITEMIZED: Specify items and who claimed them
   *
   * @param req - Express request with authenticated user
   * @param res - Express response object
   * @returns HTTP 201 with created expense
   *
   * @example
   * // POST /api/v1/expenses
   * // Header: Authorization: Bearer <token>
   * // Body: { ... }
   * router.post('/expenses', controller.createExpense.bind(controller));
   */
  async createExpense(req: Request, res: Response): Promise<void> {
    const context = this.buildRequestContext(req);

    try {
      // 1. Extract authenticated user ID from middleware
      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        this.logger.warn({
          requestId: context.requestId,
          action: "CreateExpense",
          reason: "No authenticated user",
        });
        res.status(401).json({
          success: false,
          message: "Authentication required",
          code: "AUTHENTICATION_REQUIRED",
        });
        return;
      }

      // 2. Validate user ID format
      this.validator.validateUserId(authenticatedUserId);

      // 3. Validate request payload
      const request = req.body as CreateSharedExpenseRequest;
      this.validator.validateCreateExpenseRequest(request);

      // 4. Call service with validated data
      const result = await this.service.createExpense(context, {
        creatorId: authenticatedUserId,
        description: request.description,
        totalAmount: request.totalAmount,
        splitType: request.splitType,
        participantIds: request.participantIds,
        splitConfig: request.splitConfig,
        category: request.category,
        notes: request.notes,
        expenseDate: request.expenseDate,
      });

      // 5. Return success response
      res.status(201).json({
        success: true,
        data: result,
        message: "Shared expense created successfully",
      });
    } catch (error) {
      this.handleError(error, res, context);
    }
  }

  /**
   * HTTP GET handler - Retrieve expenses created by user
   *
   * Query parameters:
   * - limit: number (default: 100, max: 1000)
   * - offset: number (default: 0)
   *
   * Authorization:
   * - User can only see their own created expenses
   *
   * @param req - Express request with authenticated user
   * @param res - Express response object
   * @returns HTTP 200 with paginated expenses
   *
   * @example
   * // GET /api/v1/expenses/created?limit=50&offset=0
   * router.get('/expenses/created', controller.getExpensesByCreator.bind(controller));
   */
  async getExpensesByCreator(req: Request, res: Response): Promise<void> {
    const context = this.buildRequestContext(req);

    try {
      // 1. Extract authenticated user ID
      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
          code: "AUTHENTICATION_REQUIRED",
        });
        return;
      }

      // 2. Validate user ID
      this.validator.validateUserId(authenticatedUserId);

      // 3. Validate and normalize pagination
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      this.validator.validatePagination({ limit, offset });

      // 4. Call service
      const result = await this.service.getExpensesByCreator(
        context,
        authenticatedUserId,
        authenticatedUserId,
        limit,
        offset
      );

      // 5. Return success response
      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res, context);
    }
  }

  /**
   * HTTP GET handler - Retrieve expenses where user is a participant
   *
   * Query parameters:
   * - limit: number (default: 100, max: 1000)
   * - offset: number (default: 0)
   *
   * Authorization:
   * - User can only see expenses they're participating in
   *
   * @param req - Express request with authenticated user
   * @param res - Express response object
   * @returns HTTP 200 with paginated expenses
   *
   * @example
   * // GET /api/v1/expenses/participating?limit=50&offset=0
   * router.get('/expenses/participating', controller.getExpensesByParticipant.bind(controller));
   */
  async getExpensesByParticipant(req: Request, res: Response): Promise<void> {
    const context = this.buildRequestContext(req);

    try {
      // 1. Extract authenticated user ID
      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
          code: "AUTHENTICATION_REQUIRED",
        });
        return;
      }

      // 2. Validate user ID
      this.validator.validateUserId(authenticatedUserId);

      // 3. Validate and normalize pagination
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const offset = req.query.offset ? Number(req.query.offset) : 0;
      this.validator.validatePagination({ limit, offset });

      // 4. Call service
      const result = await this.service.getExpensesByParticipant(
        context,
        authenticatedUserId,
        authenticatedUserId,
        limit,
        offset
      );

      // 5. Return success response
      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res, context);
    }
  }

  /**
   * HTTP GET handler - Retrieve a specific expense by ID
   *
   * Authorization:
   * - Creator can view
   * - Participants can view
   *
   * @param req - Express request with expense ID in URL
   * @param res - Express response object
   * @returns HTTP 200 with expense details
   *
   * @example
   * // GET /api/v1/expenses/:expenseId
   * router.get('/expenses/:expenseId', controller.getExpenseById.bind(controller));
   */
  async getExpenseById(req: Request, res: Response): Promise<void> {
    const context = this.buildRequestContext(req);

    try {
      // 1. Extract authenticated user ID
      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
          code: "AUTHENTICATION_REQUIRED",
        });
        return;
      }

      // 2. Extract and validate expense ID from URL
      const { expenseId } = req.params;
      if (!expenseId) {
        res.status(400).json({
          success: false,
          message: "Expense ID is required",
          code: "MISSING_EXPENSE_ID",
        });
        return;
      }

      // 3. Call service
      const result = await this.service.getExpenseById(
        context,
        expenseId,
        authenticatedUserId
      );

      // 4. Return success response
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.handleError(error, res, context);
    }
  }

  /**
   * HTTP POST handler - Record a settlement payment
   *
   * Expects JSON request body:
   * ```json
   * {
   *   "amount": 30.00,
   *   "paidByUserId": "user-123",
   *   "paymentMethod": "BANK_TRANSFER",
   *   "transactionReference": "TXN-123456"
   * }
   * ```
   *
   * Authorization:
   * - User can only record their own payments
   * - User must be a participant in the expense
   *
   * @param req - Express request with expense ID and payment details
   * @param res - Express response object
   * @returns HTTP 200 with updated balance
   *
   * @example
   * // POST /api/v1/expenses/:expenseId/settle
   * router.post('/expenses/:expenseId/settle', controller.recordSettlement.bind(controller));
   */
  async recordSettlement(req: Request, res: Response): Promise<void> {
    const context = this.buildRequestContext(req);

    try {
      // 1. Extract authenticated user ID
      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
          code: "AUTHENTICATION_REQUIRED",
        });
        return;
      }

      // 2. Extract expense ID
      const { expenseId } = req.params;
      if (!expenseId) {
        res.status(400).json({
          success: false,
          message: "Expense ID is required",
          code: "MISSING_EXPENSE_ID",
        });
        return;
      }

      // 3. Validate request payload
      const request = req.body as RecordSettlementRequest;
      this.validator.validateRecordSettlementRequest(request);

      // 4. Call service
      const result = await this.service.recordSettlement(
        context,
        expenseId,
        request,
        authenticatedUserId
      );

      // 5. Return success response
      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res, context);
    }
  }

  /**
   * HTTP GET handler - Retrieve user's net balance
   *
   * Returns:
   * - Total owed across all expenses
   * - Total paid across all expenses
   * - Net balance (how much they still owe or are owed)
   * - Number of expenses involved
   *
   * Authorization:
   * - User can only see their own balance
   *
   * @param req - Express request with authenticated user
   * @param res - Express response object
   * @returns HTTP 200 with balance summary
   *
   * @example
   * // GET /api/v1/expenses/balance/net
   * router.get('/expenses/balance/net', controller.getNetUserBalance.bind(controller));
   */
  async getNetUserBalance(req: Request, res: Response): Promise<void> {
    const context = this.buildRequestContext(req);

    try {
      // 1. Extract authenticated user ID
      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
          code: "AUTHENTICATION_REQUIRED",
        });
        return;
      }

      // 2. Validate user ID
      this.validator.validateUserId(authenticatedUserId);

      // 3. Call service
      const result = await this.service.getNetUserBalance(
        context,
        authenticatedUserId,
        authenticatedUserId
      );

      // 4. Return success response
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      this.handleError(error, res, context);
    }
  }

  /**
   * HTTP GET handler - Retrieve optimal settlement path for expense
   *
   * Returns minimum number of payments needed to settle all debts.
   *
   * Example:
   * - Expense: $120 split 4 ways
   * - Alice paid full amount
   * - Bob, Charlie, Diana haven't paid
   *
   * Optimal settlements: Bob→Alice ($30), Charlie→Alice ($30), Diana→Alice ($30)
   * Result: 3 payments minimum
   *
   * Authorization:
   * - Creator or participant can view
   *
   * @param req - Express request with expense ID
   * @param res - Express response object
   * @returns HTTP 200 with settlement recommendations
   *
   * @example
   * // GET /api/v1/expenses/:expenseId/settlements/optimal
   * router.get('/expenses/:expenseId/settlements/optimal', controller.getOptimalSettlements.bind(controller));
   */
  async getOptimalSettlements(req: Request, res: Response): Promise<void> {
    const context = this.buildRequestContext(req);

    try {
      // 1. Extract authenticated user ID
      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
          code: "AUTHENTICATION_REQUIRED",
        });
        return;
      }

      // 2. Extract expense ID
      const { expenseId } = req.params;
      if (!expenseId) {
        res.status(400).json({
          success: false,
          message: "Expense ID is required",
          code: "MISSING_EXPENSE_ID",
        });
        return;
      }

      // 3. Call service
      const result = await this.service.getOptimalSettlements(
        context,
        expenseId,
        authenticatedUserId
      );

      // 4. Return success response
      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res, context);
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Builds request context from Express request
   *
   * @private
   */
  private buildRequestContext(req: any): RequestContext {
    return {
      requestId: req.requestId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      authenticatedUserId: req.user?.id,
    };
  }

  /**
   * Handles errors and maps them to HTTP responses
   *
   * @private
   */
  private handleError(error: any, res: Response, context: RequestContext): void {
    // Validation errors → 400
    if (error instanceof ExpenseValidationException) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return;
    }

    // Authorization errors → 403
    if (error instanceof ExpenseUnauthorizedException) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return;
    }

    // Not found errors → 404
    if (error instanceof ExpenseNotFoundException) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return;
    }

    // Split calculation errors → 400
    if (error instanceof ExpenseSplitException) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return;
    }

    // Database errors → 500
    if (error instanceof ExpenseDatabaseException) {
      this.logger.error({
        requestId: context.requestId,
        action: "HandleError",
        error: error.message,
      });
      res.status(error.statusCode).json({
        success: false,
        message: "Database operation failed",
        code: "DATABASE_ERROR",
      });
      return;
    }

    // Unknown errors → 500
    this.logger.error({
      requestId: context.requestId,
      action: "HandleError",
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
}
