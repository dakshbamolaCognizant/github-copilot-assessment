/**
 * Shared Expense Module - Route Definitions
 *
 * This module:
 * 1. Defines all API endpoints for shared expenses
 * 2. Wires dependencies using factory pattern
 * 3. Applies middleware for authentication and error handling
 * 4. Documents all routes with examples
 *
 * @module expenses/routes
 */

import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { SharedExpenseController } from "./expense.controller";
import { SharedExpenseService } from "./expense.service";
import { SharedExpenseRepository } from "./expense.model";
import { ExpenseValidator } from "./expense.validator";
import { Logger } from "../logger";

/**
 * Factory function for creating shared expense routes
 *
 * Uses dependency injection pattern to wire all dependencies.
 * This approach:
 * - Makes testing easier (dependencies can be mocked)
 * - Makes dependencies explicit
 * - Supports multiple instances with different configurations
 *
 * @param prisma - Prisma Client instance for database access
 * @param logger - Logger instance for structured logging
 * @returns Express Router with all shared expense routes
 *
 * @example
 * const router = createSharedExpenseRoutes(prisma, logger);
 * app.use('/api/v1/expenses', router);
 */
export function createSharedExpenseRoutes(
  prisma: PrismaClient,
  logger: Logger
): Router {
  // 1. Initialize dependencies in order
  const repository = new SharedExpenseRepository(prisma);
  const service = new SharedExpenseService(repository, logger);
  const validator = new ExpenseValidator();
  const controller = new SharedExpenseController(service, validator, logger);

  // 2. Create router
  const router = Router();

  // ===== POST ROUTES (Create) =====

  /**
   * POST /api/v1/expenses
   *
   * Create a new shared expense
   *
   * Request:
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
   * Response (201 Created):
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "id": "exp-123",
   *     "creatorId": "user-123",
   *     "description": "Dinner with friends",
   *     "totalAmount": 120.50,
   *     "splitType": "EQUAL",
   *     "status": "PENDING",
   *     "participants": [
   *       {
   *         "userId": "user-123",
   *         "owedAmount": 40.17,
   *         "paidAmount": 0,
   *         "balanceRemaining": 40.17
   *       },
   *       {
   *         "userId": "user-456",
   *         "owedAmount": 40.17,
   *         "paidAmount": 0,
   *         "balanceRemaining": 40.17
   *       },
   *       {
   *         "userId": "user-789",
   *         "owedAmount": 40.16,
   *         "paidAmount": 0,
   *         "balanceRemaining": 40.16
   *       }
   *     ],
   *     "createdAt": "2024-01-15T10:30:00Z",
   *     "updatedAt": "2024-01-15T10:30:00Z"
   *   },
   *   "message": "Shared expense created successfully"
   * }
   * ```
   *
   * Errors:
   * - 400: Validation error (invalid split config, participants, amounts)
   * - 401: Authentication required
   * - 500: Database error
   *
   * Authorization:
   * - Authenticated user (via middleware)
   * - User must be included in participantIds
   *
   * Split Types:
   * - EQUAL: Divide equally (remainder goes to last person)
   * - BY_AMOUNT: Specify exact dollar amount per person
   * - BY_PERCENTAGE: Specify percentage per person (must sum to 100)
   * - ITEMIZED: Assign items to specific people
   */
  router.post("/", (req: Request, res: Response) =>
    controller.createExpense(req, res)
  );

  /**
   * POST /api/v1/expenses/:expenseId/settle
   *
   * Record a settlement payment for an expense
   *
   * Request:
   * ```json
   * {
   *   "amount": 40.17,
   *   "paidByUserId": "user-123",
   *   "paymentMethod": "BANK_TRANSFER",
   *   "transactionReference": "TXN-ABC-123456"
   * }
   * ```
   *
   * Response (200 OK):
   * ```json
   * {
   *   "success": true,
   *   "expenseId": "exp-123",
   *   "participantUserId": "user-123",
   *   "paymentRecorded": 40.17,
   *   "newBalance": 0,
   *   "expenseStatus": "SETTLED"
   * }
   * ```
   *
   * Authorization:
   * - User can only record their own payments (paidByUserId must match authenticated user)
   * - User must be a participant in the expense
   *
   * Business Logic:
   * 1. Validates payment amount is positive
   * 2. Validates payment doesn't exceed remaining debt
   * 3. Updates participant's paid amount in database
   * 4. Recalculates expense settlement status
   * 5. Returns updated balance
   */
  router.post("/:expenseId/settle", (req: Request, res: Response) =>
    controller.recordSettlement(req, res)
  );

  // ===== GET ROUTES (Retrieve) =====

  /**
   * GET /api/v1/expenses/:expenseId
   *
   * Retrieve a specific shared expense by ID
   *
   * Query Parameters: (none)
   *
   * Response (200 OK):
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "id": "exp-123",
   *     "creatorId": "user-123",
   *     "description": "Dinner with friends",
   *     "totalAmount": 120.50,
   *     "splitType": "EQUAL",
   *     "status": "PARTIALLY_PAID",
   *     "participants": [
   *       {
   *         "userId": "user-123",
   *         "owedAmount": 40.17,
   *         "paidAmount": 40.17,
   *         "balanceRemaining": 0
   *       }
   *     ],
   *     "createdAt": "2024-01-15T10:30:00Z",
   *     "updatedAt": "2024-01-15T10:30:00Z"
   *   }
   * }
   * ```
   *
   * Authorization:
   * - Creator can view their expense
   * - Participants can view the expense
   * - Others: 403 Forbidden
   *
   * Errors:
   * - 404: Expense not found
   * - 403: User not authorized to view
   */
  router.get("/:expenseId", (req: Request, res: Response) =>
    controller.getExpenseById(req, res)
  );

  /**
   * GET /api/v1/expenses/created
   *
   * Retrieve all expenses created by authenticated user
   *
   * Query Parameters:
   * - limit: number (1-1000, default: 100)
   * - offset: number (≥0, default: 0)
   *
   * Response (200 OK):
   * ```json
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "id": "exp-123",
   *       "creatorId": "user-123",
   *       "description": "Dinner",
   *       "totalAmount": 120.50,
   *       "status": "PENDING",
   *       "participants": [],
   *       "createdAt": "2024-01-15T10:30:00Z",
   *       "updatedAt": "2024-01-15T10:30:00Z"
   *     }
   *   ],
   *   "pagination": {
   *     "limit": 100,
   *     "offset": 0,
   *     "total": 5,
   *     "hasMore": false
   *   }
   * }
   * ```
   *
   * Authorization:
   * - User can only view their own created expenses
   * - Authenticated user ID must match creatorId
   *
   * Errors:
   * - 400: Invalid pagination (limit > 1000 or < 1)
   */
  router.get("/created", (req: Request, res: Response) =>
    controller.getExpensesByCreator(req, res)
  );

  /**
   * GET /api/v1/expenses/participating
   *
   * Retrieve all expenses where authenticated user is a participant
   *
   * Query Parameters:
   * - limit: number (1-1000, default: 100)
   * - offset: number (≥0, default: 0)
   *
   * Response (200 OK):
   * ```json
   * {
   *   "success": true,
   *   "data": [
   *     {
   *       "id": "exp-456",
   *       "creatorId": "other-user",
   *       "description": "Group movie night",
   *       "totalAmount": 80,
   *       "status": "PARTIALLY_PAID",
   *       "participants": [
   *         {
   *           "userId": "user-123",
   *           "owedAmount": 20,
   *           "paidAmount": 10,
   *           "balanceRemaining": 10
   *         }
   *       ]
   *     }
   *   ],
   *   "pagination": { ... }
   * }
   * ```
   *
   * Authorization:
   * - User can only see expenses they're participating in
   *
   * Notes:
   * - Does not include expenses they created (use /created for that)
   * - Shows expenses sorted by most recent first
   */
  router.get("/participating", (req: Request, res: Response) =>
    controller.getExpensesByParticipant(req, res)
  );

  /**
   * GET /api/v1/expenses/balance/net
   *
   * Retrieve user's net balance across all expenses
   *
   * Calculates:
   * - Total owed across all expenses
   * - Total paid across all expenses
   * - Net balance = total owed - total paid
   *   - Positive: User still owes money
   *   - Negative: User is owed money (overpaid)
   *   - Zero: User is settled
   *
   * Response (200 OK):
   * ```json
   * {
   *   "success": true,
   *   "data": {
   *     "userId": "user-123",
   *     "totalOwed": 500.00,
   *     "totalPaid": 250.00,
   *     "netBalance": 250.00,
   *     "expenseCount": 3
   *   }
   * }
   * ```
   *
   * Authorization:
   * - User can only view their own balance
   *
   * Use Cases:
   * - Dashboard summary
   * - Quick financial position check
   * - Settlement recommendations
   *
   * Note: This endpoint queries all expenses where user is a participant,
   * which may be expensive for users in many expenses. Consider caching
   * or adding a database view for high-traffic scenarios.
   */
  router.get("/balance/net", (req: Request, res: Response) =>
    controller.getNetUserBalance(req, res)
  );

  /**
   * GET /api/v1/expenses/:expenseId/settlements/optimal
   *
   * Retrieve optimal settlement path for an expense
   *
   * Uses Algorithm 7 (Greedy Matching) to minimize payment count.
   *
   * Example:
   * Input:
   * - Alice: owed $25, paid $100 (overpaid $75, owed $75)
   * - Bob: owed $25, paid $0
   * - Charlie: owed $25, paid $0
   * - Diana: owed $25, paid $0
   *
   * Optimal settlements (3 payments):
   * 1. Bob → Alice: $25
   * 2. Charlie → Alice: $25
   * 3. Diana → Alice: $25
   *
   * Response (200 OK):
   * ```json
   * {
   *   "success": true,
   *   "expenseId": "exp-123",
   *   "settlements": [
   *     {
   *       "from": "user-456",
   *       "to": "user-123",
   *       "amount": 25.00
   *     },
   *     {
   *       "from": "user-789",
   *       "to": "user-123",
   *       "amount": 25.00
   *     },
   *     {
   *       "from": "user-999",
   *       "to": "user-123",
   *       "amount": 25.00
   *     }
   *   ]
   * }
   * ```
   *
   * Authorization:
   * - Creator or participant can view
   * - Others: 403 Forbidden
   *
   * Algorithm:
   * 1. Calculate net balance for each participant
   * 2. Separate into creditors (owed money) and debtors (owe money)
   * 3. Sort both lists by amount (descending)
   * 4. Greedily match largest debtor with largest creditor
   * 5. Return minimum transaction list
   *
   * Benefits:
   * - Minimizes number of transactions
   * - Avoids unnecessary intermediary transfers
   * - Deterministic and reproducible
   *
   * Errors:
   * - 404: Expense not found
   * - 403: User not authorized
   */
  router.get("/:expenseId/settlements/optimal", (req: Request, res: Response) =>
    controller.getOptimalSettlements(req, res)
  );

  return router;
}

/**
 * Export type definitions for route setup
 */
export type SharedExpenseRouter = ReturnType<typeof createSharedExpenseRoutes>;
