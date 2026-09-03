/**
 * Transaction Module - Controller Layer (HTTP Request/Response Handling)
 *
 * The controller layer handles:
 * - HTTP request parsing and validation
 * - Calling appropriate service methods
 * - Building HTTP responses
 * - Error handling and status code mapping
 * - Request context propagation
 *
 * The controller should NOT contain:
 * - Business logic (belongs in service)
 * - Database queries (belongs in repository)
 * - Low-level validation (belongs in validator)
 * - Authorization checks (belongs in middleware)
 *
 * @module transactions/controller
 */

import { Request, Response } from "express";
import { TransactionService } from "./transaction.service";
import { TransactionValidator } from "./transaction.validator";
import { Logger } from "../logger";
import {
  TransactionException,
  TransactionValidationException,
  TransactionUnauthorizedException,
  TransactionNotFoundException,
} from "./transaction.exceptions";
import { RequestContext, TransactionTypeEnum } from "./transaction.types";
import { CreateTransactionRequest } from "./transaction.dto";

/**
 * Transaction controller - handles HTTP requests for transaction operations
 */
export class TransactionController {
  /**
   * Creates a new TransactionController instance
   *
   * @param service - Transaction service for business logic
   * @param validator - Transaction validator for input validation
   * @param logger - Logger for structured logging
   */
  constructor(
    private service: TransactionService,
    private validator: TransactionValidator,
    private logger: Logger
  ) {}

  /**
   * HTTP POST handler - Create a new transaction
   *
   * Expects JSON request body:
   * ```json
   * {
   *   "amount": 100.50,
   *   "type": "TRANSFER",
   *   "description": "Payment for services"
   * }
   * ```
   *
   * @param req - Express request object with authenticated user
   * @param res - Express response object
   * @returns HTTP response with created transaction
   *
   * @example
   * // POST /api/v1/transactions
   * router.post('/transactions', controller.createTransaction.bind(controller));
   */
  async createTransaction(req: Request, res: Response): Promise<void> {
    const context = this.buildRequestContext(req);

    try {
      // 1. Extract authenticated user ID from middleware
      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        this.logger.warn({
          requestId: context.requestId,
          action: "CreateTransaction",
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
      const request = req.body as CreateTransactionRequest;
      this.validator.validateCreateTransactionRequest(request);

      // 4. Call service with validated data
      const result = await this.service.createTransaction(context, {
        userId: authenticatedUserId,
        amount: request.amount,
        type: request.type,
        description: request.description,
      });

      // 5. Return success response
      res.status(201).json({
        success: true,
        data: result,
        message: "Transaction created successfully",
      });
    } catch (error) {
      this.handleError(error, res, context);
    }
  }

  /**
   * HTTP GET handler - Retrieve user's transactions with pagination
   *
   * Query parameters:
   * - limit: number (default: 100, max: 1000)
   * - offset: number (default: 0)
   *
   * @param req - Express request object
   * @param res - Express response object
   * @returns HTTP response with paginated transactions
   *
   * @example
   * // GET /api/v1/transactions?limit=50&offset=0
   * router.get('/transactions', controller.getTransactions.bind(controller));
   */
  async getTransactions(req: Request, res: Response): Promise<void> {
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
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const pagination = this.validator.validatePagination(limit, offset);

      // 4. Call service
      const result = await this.service.getTransactionsByUser(
        context,
        authenticatedUserId,
        pagination
      );

      // 5. Return paginated response
      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res, context);
    }
  }

  /**
   * HTTP DELETE handler - Delete all transactions for user
   *
   * ⚠️ This is a destructive operation. Consider requiring additional confirmation.
   *
   * @param req - Express request object
   * @param res - Express response object
   * @returns HTTP response with deletion count
   *
   * @example
   * // DELETE /api/v1/transactions
   * router.delete('/transactions', controller.deleteAllTransactions.bind(controller));
   */
  async deleteAllTransactions(req: Request, res: Response): Promise<void> {
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
      const deletedCount = await this.service.deleteAllTransactionsByUser(
        context,
        authenticatedUserId
      );

      // 4. Return success response
      res.status(200).json({
        success: true,
        deletedCount,
        message: `${deletedCount} transaction(s) deleted successfully`,
      });
    } catch (error) {
      this.handleError(error, res, context);
    }
  }

  /**
   * Builds request context from Express request
   *
   * @private
   * @param req - Express request object
   * @returns Request context with requestId and timestamp
   */
  private buildRequestContext(req: Request): RequestContext {
    return {
      requestId: req.id || (req as any).requestId || "unknown",
      authenticatedUserId: req.user?.id || "unknown",
      timestamp: new Date(),
    };
  }

  /**
   * Handles errors and sends appropriate HTTP responses
   *
   * Maps domain exceptions to HTTP status codes and error responses.
   *
   * @private
   * @param error - The error to handle
   * @param res - Express response object
   * @param context - Request context for logging
   */
  private handleError(error: unknown, res: Response, context: RequestContext): void {
    // Handle domain-specific exceptions
    if (error instanceof TransactionValidationException) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return;
    }

    if (error instanceof TransactionUnauthorizedException) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      });
      return;
    }

    if (error instanceof TransactionNotFoundException) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      });
      return;
    }

    if (error instanceof TransactionException) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return;
    }

    // Handle unknown errors
    this.logger.error({
      requestId: context.requestId,
      userId: context.authenticatedUserId,
      action: "ErrorHandler",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "INTERNAL_SERVER_ERROR",
    });
  }
}
