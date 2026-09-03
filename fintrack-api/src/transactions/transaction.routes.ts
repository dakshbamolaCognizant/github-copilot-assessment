/**
 * Transaction Module - Route Definition
 *
 * Defines Express routes for transaction operations.
 * Routes are mapped to controller methods with appropriate HTTP methods and middleware.
 *
 * Middleware execution order (per Express request):
 * 1. Authentication middleware - verifies JWT token
 * 2. Authorization middleware - checks resource access
 * 3. Request ID middleware - generates request ID for tracing
 * 4. Logging middleware - logs request details
 * 5. Route handler (controller) - processes request
 *
 * @module transactions/routes
 */

import { Router } from "express";
import { TransactionController } from "./transaction.controller";
import { TransactionService } from "./transaction.service";
import { TransactionValidator } from "./transaction.validator";
import { TransactionRepository } from "./transaction.repository";
import { PrismaClient } from "@prisma/client";
import { Logger } from "../logger";

/**
 * Creates and configures transaction routes
 *
 * @param prisma - Prisma Client instance
 * @param logger - Logger instance
 * @returns Configured Express router
 *
 * @example
 * const router = createTransactionRoutes(prisma, logger);
 * app.use('/api/v1/transactions', router);
 */
export function createTransactionRoutes(
  prisma: PrismaClient,
  logger: Logger
): Router {
  const router = Router();

  // Initialize dependencies (dependency injection)
  const repository = new TransactionRepository(prisma);
  const service = new TransactionService(repository, logger);
  const validator = new TransactionValidator();
  const controller = new TransactionController(service, validator, logger);

  /**
   * POST /api/v1/transactions
   * Create a new transaction
   *
   * Authentication: Required (JWT token)
   * Authorization: User can only create transactions for themselves
   *
   * Request body:
   * ```json
   * {
   *   "amount": 100.50,
   *   "type": "TRANSFER",
   *   "description": "Optional description"
   * }
   * ```
   *
   * Success response (201):
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "id": "txn_123",
   *     "amount": 100.50,
   *     "type": "TRANSFER",
   *     "status": "COMPLETED",
   *     "createdAt": "2024-01-01T00:00:00Z",
   *     "updatedAt": "2024-01-01T00:00:00Z"
   *   },
   *   "message": "Transaction created successfully"
   * }
   * ```
   */
  router.post("/", controller.createTransaction.bind(controller));

  /**
   * GET /api/v1/transactions
   * Retrieve user's transactions with pagination
   *
   * Authentication: Required (JWT token)
   * Authorization: User can only view their own transactions
   *
   * Query parameters:
   * - limit: number (optional, default: 100, max: 1000)
   * - offset: number (optional, default: 0)
   *
   * Success response (200):
   * ```json
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "id": "txn_123",
   *       "amount": 100.50,
   *       "type": "TRANSFER",
   *       "status": "COMPLETED",
   *       "createdAt": "2024-01-01T00:00:00Z",
   *       "updatedAt": "2024-01-01T00:00:00Z"
   *     }
   *   ],
   *   "pagination": {
   *     "total": 150,
   *     "limit": 100,
   *     "offset": 0,
   *     "hasMore": true
   *   }
   * }
   * ```
   */
  router.get("/", controller.getTransactions.bind(controller));

  /**
   * DELETE /api/v1/transactions
   * Delete all transactions for user
   *
   * Authentication: Required (JWT token)
   * Authorization: User can only delete their own transactions
   *
   * ⚠️ WARNING: This operation is IRREVERSIBLE and deletes all financial records
   *
   * Success response (200):
   * ```json
   * {
   *   "success": true,
   *   "deletedCount": 150,
   *   "message": "150 transaction(s) deleted successfully"
   * }
   * ```
   */
  router.delete("/", controller.deleteAllTransactions.bind(controller));

  return router;
}

/**
 * Module exports for direct component access
 * (for testing or alternative configurations)
 */
export { TransactionController };
export { TransactionService };
export { TransactionValidator };
export { TransactionRepository };
