/**
 * Shared Expense Module - Service Layer
 *
 * The service layer handles:
 * - Business logic for creating and managing shared expenses
 * - Split calculation using BalanceCalculator
 * - Authorization checks (defense-in-depth after middleware)
 * - Balance tracking and settlement optimization
 * - Structured logging with request context
 *
 * The service should NOT contain:
 * - HTTP request/response logic (belongs in controller)
 * - Database queries (belongs in repository)
 * - Low-level validation (belongs in validator)
 *
 * @module expenses/service
 */

import { RequestContext, ExpenseSplitTypeEnum, SettlementStatusEnum } from "./expense.types";
import { Logger } from "../logger";
import { SharedExpenseRepository } from "./expense.model";
import { BalanceCalculator } from "./balance-calculator";
import {
  SharedExpenseResponse,
  ParticipantDTO,
  CreateSharedExpenseInput,
  PaginatedSharedExpenseResponse,
  RecordSettlementRequest,
  SettlementSummaryResponse,
} from "./expense.dto";
import {
  ExpenseNotFoundException,
  ExpenseUnauthorizedException,
  ExpenseSplitException,
  ExpenseDatabaseException,
} from "./expense.exceptions";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Shared Expense Service - implements business logic for expense management
 */
export class SharedExpenseService {
  private balanceCalculator: BalanceCalculator;

  /**
   * Creates a new SharedExpenseService instance
   *
   * @param repository - Repository for database operations
   * @param logger - Logger for structured logging
   */
  constructor(
    private repository: SharedExpenseRepository,
    private logger: Logger
  ) {
    this.balanceCalculator = new BalanceCalculator();
  }

  /**
   * Creates a new shared expense with calculated splits
   *
   * Business Logic:
   * 1. Validate creator has proper permissions
   * 2. Calculate shares using BalanceCalculator
   * 3. Validate split configuration
   * 4. Create expense in database with participants
   * 5. Initialize each participant's balance
   * 6. Log creation with structured context
   *
   * Time Complexity: O(n) where n = number of participants
   * Space Complexity: O(n)
   *
   * @param context - Request context with tracing info
   * @param input - Expense creation input from controller
   * @returns Created expense with participants and balances
   * @throws {ExpenseSplitException} If split calculation fails
   * @throws {ExpenseDatabaseException} If database operation fails
   *
   * @example
   * const expense = await service.createExpense(context, {
   *   creatorId: "user-123",
   *   description: "Dinner bill",
   *   totalAmount: 120,
   *   splitType: ExpenseSplitTypeEnum.EQUAL,
   *   participantIds: ["user-456", "user-789", "user-123"]
   * });
   */
  async createExpense(
    context: RequestContext,
    input: CreateSharedExpenseInput
  ): Promise<SharedExpenseResponse> {
    const startTime = Date.now();

    try {
      this.logger.info({
        requestId: context.requestId,
        userId: input.creatorId,
        action: "CreateExpense",
        expense: {
          description: input.description,
          totalAmount: input.totalAmount,
          splitType: input.splitType,
          participantCount: input.participantIds.length,
        },
      });

      // DEFENSE-IN-DEPTH: Re-verify creator is in participants
      // (middleware already checked authentication)
      if (!input.participantIds.includes(input.creatorId)) {
        this.logger.warn({
          requestId: context.requestId,
          userId: input.creatorId,
          action: "CreateExpense",
          reason: "Creator not in participant list",
        });
        throw new ExpenseUnauthorizedException(
          "Creator must be included as participant",
          { creatorId: input.creatorId }
        );
      }

      // ALGORITHM 5: Calculate shares based on split type
      // Routes to appropriate split algorithm (1-4)
      const shares = this.balanceCalculator.calculateShares(
        input.totalAmount,
        input.participantIds,
        input.splitType,
        input.splitConfig
      );

      // Create expense with calculated shares
      const expenseData = {
        ...input,
        participantIds: input.participantIds,
        // We'll need to update participants after creation
      };

      const createdExpense = await this.repository.createExpense(expenseData);

      // Update participant balances with calculated shares
      await this.repository.updateParticipantOwedAmounts(
        createdExpense.id,
        shares
      );

      // Fetch updated expense with participant data
      const expenseWithParticipants = await this.repository.getExpenseById(
        createdExpense.id
      );

      if (!expenseWithParticipants) {
        throw new ExpenseNotFoundException(`Expense ${createdExpense.id} not found`);
      }

      const response = this.mapToResponse(expenseWithParticipants, shares);

      const duration = Date.now() - startTime;
      this.logger.info({
        requestId: context.requestId,
        userId: input.creatorId,
        action: "CreateExpense",
        result: "success",
        expenseId: createdExpense.id,
        duration,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        requestId: context.requestId,
        userId: input.creatorId,
        action: "CreateExpense",
        reason: error instanceof Error ? error.message : String(error),
        duration,
      });
      throw error;
    }
  }

  /**
   * Retrieves expenses created by a user
   *
   * Authorization:
   * - Only creator can view their own created expenses
   * - Defense-in-depth check after middleware
   *
   * @param context - Request context with tracing
   * @param creatorId - User ID to retrieve expenses for
   * @param limit - Maximum results (1-1000)
   * @param offset - Result offset for pagination
   * @returns Paginated list of expenses
   * @throws {ExpenseUnauthorizedException} If user not authorized
   * @throws {ExpenseDatabaseException} If database operation fails
   */
  async getExpensesByCreator(
    context: RequestContext,
    authenticatedUserId: string,
    creatorId: string,
    limit: number,
    offset: number
  ): Promise<PaginatedSharedExpenseResponse> {
    const startTime = Date.now();

    try {
      // DEFENSE-IN-DEPTH: Verify authenticated user matches requested creator
      if (authenticatedUserId !== creatorId) {
        this.logger.warn({
          requestId: context.requestId,
          userId: authenticatedUserId,
          action: "GetExpensesByCreator",
          reason: "Unauthorized access attempt",
          targetUserId: creatorId,
        });
        throw new ExpenseUnauthorizedException(
          "Can only view your own created expenses",
          { authenticatedUserId, requestedCreatorId: creatorId }
        );
      }

      const { expenses, total } = await this.repository.getExpensesByCreator(
        creatorId,
        limit,
        offset
      );

      const duration = Date.now() - startTime;
      this.logger.info({
        requestId: context.requestId,
        userId: authenticatedUserId,
        action: "GetExpensesByCreator",
        count: expenses.length,
        total,
        duration,
      });

      return {
        success: true,
        data: expenses.map(expense => this.mapToResponse(expense)),
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        requestId: context.requestId,
        userId: authenticatedUserId,
        action: "GetExpensesByCreator",
        reason: error instanceof Error ? error.message : String(error),
        duration,
      });
      throw error;
    }
  }

  /**
   * Retrieves expenses where user is a participant
   *
   * Authorization:
   * - User can view expenses they're participating in
   * - Defense-in-depth check after middleware
   *
   * @param context - Request context
   * @param userId - Participant user ID
   * @param limit - Maximum results
   * @param offset - Result offset
   * @returns Paginated expenses
   */
  async getExpensesByParticipant(
    context: RequestContext,
    authenticatedUserId: string,
    userId: string,
    limit: number,
    offset: number
  ): Promise<PaginatedSharedExpenseResponse> {
    const startTime = Date.now();

    try {
      // DEFENSE-IN-DEPTH: Verify authenticated user matches requested user
      if (authenticatedUserId !== userId) {
        this.logger.warn({
          requestId: context.requestId,
          userId: authenticatedUserId,
          action: "GetExpensesByParticipant",
          reason: "Unauthorized access attempt",
          targetUserId: userId,
        });
        throw new ExpenseUnauthorizedException(
          "Can only view your own expenses",
          { authenticatedUserId, requestedUserId: userId }
        );
      }

      const { expenses, total } = await this.repository.getExpensesByParticipant(
        userId,
        limit,
        offset
      );

      const duration = Date.now() - startTime;
      this.logger.info({
        requestId: context.requestId,
        userId: authenticatedUserId,
        action: "GetExpensesByParticipant",
        count: expenses.length,
        total,
        duration,
      });

      return {
        success: true,
        data: expenses.map(expense => this.mapToResponse(expense)),
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + limit < total,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        requestId: context.requestId,
        userId: authenticatedUserId,
        action: "GetExpensesByParticipant",
        reason: error instanceof Error ? error.message : String(error),
        duration,
      });
      throw error;
    }
  }

  /**
   * Retrieves a specific expense by ID
   *
   * Authorization:
   * - Creator can view their own expenses
   * - Participants can view expenses they're part of
   *
   * @param context - Request context
   * @param expenseId - Expense ID
   * @param authenticatedUserId - User making request
   * @returns Expense details with participants and balances
   * @throws {ExpenseNotFoundException} If expense not found
   * @throws {ExpenseUnauthorizedException} If user not authorized to view
   */
  async getExpenseById(
    context: RequestContext,
    expenseId: string,
    authenticatedUserId: string
  ): Promise<SharedExpenseResponse> {
    const startTime = Date.now();

    try {
      const expense = await this.repository.getExpenseById(expenseId);

      if (!expense) {
        this.logger.warn({
          requestId: context.requestId,
          userId: authenticatedUserId,
          action: "GetExpenseById",
          reason: "Expense not found",
          expenseId,
        });
        throw new ExpenseNotFoundException(`Expense ${expenseId} not found`);
      }

      // DEFENSE-IN-DEPTH: Verify user is creator or participant
      const isCreator = expense.creatorId === authenticatedUserId;
      const isParticipant = expense.participants?.some(p => p.userId === authenticatedUserId);

      if (!isCreator && !isParticipant) {
        this.logger.warn({
          requestId: context.requestId,
          userId: authenticatedUserId,
          action: "GetExpenseById",
          reason: "Unauthorized access to expense",
          expenseId,
          creatorId: expense.creatorId,
        });
        throw new ExpenseUnauthorizedException(
          "You do not have access to this expense",
          { expenseId, userId: authenticatedUserId }
        );
      }

      const duration = Date.now() - startTime;
      this.logger.info({
        requestId: context.requestId,
        userId: authenticatedUserId,
        action: "GetExpenseById",
        expenseId,
        duration,
      });

      return this.mapToResponse(expense);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        requestId: context.requestId,
        userId: authenticatedUserId,
        action: "GetExpenseById",
        reason: error instanceof Error ? error.message : String(error),
        duration,
      });
      throw error;
    }
  }

  /**
   * Records a settlement payment for an expense
   *
   * Business Logic:
   * 1. Verify user is making their own payment (not paying for others)
   * 2. Apply payment to their balance
   * 3. Update participant record in database
   * 4. Recalculate expense settlement status
   * 5. Log transaction with full context
   *
   * @param context - Request context
   * @param expenseId - Expense ID
   * @param request - Settlement payment details
   * @param authenticatedUserId - User making the payment
   * @returns Updated settlement summary
   */
  async recordSettlement(
    context: RequestContext,
    expenseId: string,
    request: RecordSettlementRequest,
    authenticatedUserId: string
  ): Promise<SettlementSummaryResponse> {
    const startTime = Date.now();

    try {
      this.logger.info({
        requestId: context.requestId,
        userId: authenticatedUserId,
        action: "RecordSettlement",
        expenseId,
        paymentAmount: request.amount,
      });

      // Fetch expense
      const expense = await this.repository.getExpenseById(expenseId);
      if (!expense) {
        throw new ExpenseNotFoundException(`Expense ${expenseId} not found`);
      }

      // DEFENSE-IN-DEPTH: Verify user is paying their own balance
      // (not another participant's balance)
      if (request.paidByUserId !== authenticatedUserId) {
        this.logger.warn({
          requestId: context.requestId,
          userId: authenticatedUserId,
          action: "RecordSettlement",
          reason: "Cannot record payment for another user",
          attemptedPayer: request.paidByUserId,
        });
        throw new ExpenseUnauthorizedException(
          "Can only record your own payments",
          { authenticatedUserId, requestedPayer: request.paidByUserId }
        );
      }

      // Verify user is a participant
      const participant = expense.participants?.find(p => p.userId === authenticatedUserId);
      if (!participant) {
        throw new ExpenseUnauthorizedException(
          "You are not a participant in this expense",
          { userId: authenticatedUserId, expenseId }
        );
      }

      // ALGORITHM 10: Apply payment with validation
      const currentBalance = {
        userId: participant.userId,
        balance: Number(participant.owedAmount) - Number(participant.paidAmount),
        owedAmount: Number(participant.owedAmount),
        paidAmount: Number(participant.paidAmount),
      };

      const updatedBalance = this.balanceCalculator.applyPayment(
        currentBalance,
        request.amount
      );

      // Update in database
      await this.repository.updateParticipantPayment(
        expenseId,
        authenticatedUserId,
        request.amount
      );

      // Get updated expense status
      const newStatus = await this.repository.getExpenseSettlementStatus(expenseId);

      const duration = Date.now() - startTime;
      this.logger.info({
        requestId: context.requestId,
        userId: authenticatedUserId,
        action: "RecordSettlement",
        result: "success",
        expenseId,
        paymentAmount: request.amount,
        newBalance: updatedBalance.balance,
        expenseStatus: newStatus,
        duration,
      });

      return {
        success: true,
        expenseId,
        participantUserId: authenticatedUserId,
        paymentRecorded: request.amount,
        newBalance: updatedBalance.balance,
        expenseStatus: newStatus,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        requestId: context.requestId,
        userId: authenticatedUserId,
        action: "RecordSettlement",
        reason: error instanceof Error ? error.message : String(error),
        duration,
      });
      throw error;
    }
  }

  /**
   * Calculates net user balances across all their expenses
   *
   * Returns:
   * - Total owed across all expenses
   * - Total paid across all expenses
   * - Net balance (total owed - total paid)
   *
   * This is useful for displaying a user's overall financial position
   * in the expense sharing system.
   *
   * Time Complexity: O(n) where n = expenses × participants
   * Space Complexity: O(n)
   *
   * @param context - Request context
   * @param userId - User to get balance for
   * @param authenticatedUserId - Authenticated user making request
   * @returns User's net balance summary
   * @throws {ExpenseUnauthorizedException} If accessing another user's balance
   *
   * @example
   * const balance = await service.getNetUserBalance(context, "user-123", "user-123");
   * // Returns:
   * // {
   * //   userId: "user-123",
   * //   totalOwed: 500,
   * //   totalPaid: 250,
   * //   netBalance: 250,  // Still owes $250
   * //   expenseCount: 3
   * // }
   */
  async getNetUserBalance(
    context: RequestContext,
    userId: string,
    authenticatedUserId: string
  ): Promise<{
    userId: string;
    totalOwed: number;
    totalPaid: number;
    netBalance: number;
    expenseCount: number;
  }> {
    const startTime = Date.now();

    try {
      // DEFENSE-IN-DEPTH: Verify authenticated user matches requested user
      if (authenticatedUserId !== userId) {
        this.logger.warn({
          requestId: context.requestId,
          userId: authenticatedUserId,
          action: "GetNetUserBalance",
          reason: "Unauthorized access attempt",
          targetUserId: userId,
        });
        throw new ExpenseUnauthorizedException(
          "Can only view your own balance",
          { authenticatedUserId, requestedUserId: userId }
        );
      }

      // Get all expenses where user is a participant
      // Use a high limit to get all expenses
      const { expenses } = await this.repository.getExpensesByParticipant(
        userId,
        10000, // High limit to get all
        0
      );

      // Calculate totals across all expenses
      let totalOwed = 0;
      let totalPaid = 0;

      for (const expense of expenses) {
        const participant = expense.participants?.find(p => p.userId === userId);
        if (participant) {
          totalOwed += Number(participant.owedAmount);
          totalPaid += Number(participant.paidAmount);
        }
      }

      const netBalance = totalOwed - totalPaid;

      const duration = Date.now() - startTime;
      this.logger.info({
        requestId: context.requestId,
        userId: authenticatedUserId,
        action: "GetNetUserBalance",
        totalOwed,
        totalPaid,
        netBalance,
        expenseCount: expenses.length,
        duration,
      });

      return {
        userId,
        totalOwed: Math.round(totalOwed * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        netBalance: Math.round(netBalance * 100) / 100,
        expenseCount: expenses.length,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        requestId: context.requestId,
        userId: authenticatedUserId,
        action: "GetNetUserBalance",
        reason: error instanceof Error ? error.message : String(error),
        duration,
      });
      throw error;
    }
  }

  /**
   * Gets optimal settlement path for an expense
   *
   * Uses ALGORITHM 7: Optimal Settlement Path (Greedy Matching)
   *
   * Returns minimum number of payments needed to fully settle all debts.
   *
   * Example:
   * - Expense: $120, split 4 ways
   * - Alice paid $120, owes $30
   * - Bob owes $30, hasn't paid
   * - Charlie owes $30, hasn't paid
   * - Diana owes $30, hasn't paid
   *
   * Optimal settlements:
   * 1. Bob pays Alice $30
   * 2. Charlie pays Alice $30
   * 3. Diana pays Alice $30
   *
   * Result: 3 payments instead of many potential permutations
   *
   * @param context - Request context
   * @param expenseId - Expense ID
   * @param authenticatedUserId - User requesting settlements
   * @returns List of optimal settlement transactions
   * @throws {ExpenseNotFoundException} If expense not found
   * @throws {ExpenseUnauthorizedException} If user not authorized
   */
  async getOptimalSettlements(
    context: RequestContext,
    expenseId: string,
    authenticatedUserId: string
  ): Promise<{
    success: boolean;
    expenseId: string;
    settlements: Array<{
      from: string;
      to: string;
      amount: number;
    }>;
  }> {
    const startTime = Date.now();

    try {
      const expense = await this.repository.getExpenseById(expenseId);

      if (!expense) {
        throw new ExpenseNotFoundException(`Expense ${expenseId} not found`);
      }

      // Verify authorization (creator or participant)
      const isCreator = expense.creatorId === authenticatedUserId;
      const isParticipant = expense.participants?.some(p => p.userId === authenticatedUserId);

      if (!isCreator && !isParticipant) {
        throw new ExpenseUnauthorizedException(
          "You do not have access to this expense",
          { expenseId, userId: authenticatedUserId }
        );
      }

      // Convert Prisma data to calculator format
      const expenseForCalculation = {
        id: expense.id,
        creatorId: expense.creatorId,
        totalAmount: Number(expense.totalAmount),
        participants: (expense.participants || []).map(p => ({
          userId: p.userId,
          owedAmount: Number(p.owedAmount),
          paidAmount: Number(p.paidAmount),
        })),
        settlements: (expense.settlements || []).map(s => ({
          paidByUserId: s.paidByUserId,
          paidToUserId: s.paidToUserId,
          amount: Number(s.amount),
          date: s.settledAt || new Date(),
        })),
      };

      // ALGORITHM 7: Calculate optimal settlement path
      const settlements = this.balanceCalculator.calculateOptimalSettlements(
        expenseForCalculation
      );

      // Verify settlements are valid using Algorithm 8
      const isValid = this.balanceCalculator.validateSettlements(
        expenseForCalculation,
        settlements
      );

      if (!isValid) {
        this.logger.warn({
          requestId: context.requestId,
          userId: authenticatedUserId,
          action: "GetOptimalSettlements",
          reason: "Generated settlements failed validation",
          expenseId,
        });
      }

      const duration = Date.now() - startTime;
      this.logger.info({
        requestId: context.requestId,
        userId: authenticatedUserId,
        action: "GetOptimalSettlements",
        expenseId,
        settlementCount: settlements.length,
        valid: isValid,
        duration,
      });

      return {
        success: true,
        expenseId,
        settlements,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error({
        requestId: context.requestId,
        userId: authenticatedUserId,
        action: "GetOptimalSettlements",
        reason: error instanceof Error ? error.message : String(error),
        duration,
      });
      throw error;
    }
  }

  // ===== HELPER METHODS =====

  /**
   * Maps database expense to response DTO
   *
   * @private
   */
  private mapToResponse(expense: any, overrideShares?: Record<string, number>): SharedExpenseResponse {
    return {
      id: expense.id,
      creatorId: expense.creatorId,
      description: expense.description,
      totalAmount: Number(expense.totalAmount),
      splitType: expense.splitType,
      status: expense.status,
      category: expense.category,
      notes: expense.notes,
      expenseDate: expense.expenseDate,
      participants: (expense.participants || []).map((p: any) => ({
        userId: p.userId,
        owedAmount: overrideShares?.[p.userId] || Number(p.owedAmount),
        paidAmount: Number(p.paidAmount),
        balanceRemaining: (overrideShares?.[p.userId] || Number(p.owedAmount)) - Number(p.paidAmount),
      })),
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    };
  }
}
