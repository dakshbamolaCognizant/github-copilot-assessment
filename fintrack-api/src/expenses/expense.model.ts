/**
 * Shared Expense Module - Repository Layer
 *
 * Handles all database interactions using Prisma ORM for shared expenses.
 *
 * @module expenses/repository
 */

import { PrismaClient, SharedExpense as PrismaSharedExpense } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { ExpenseDatabaseException } from "./expense.exceptions";
import { ExpenseSplitTypeEnum, SettlementStatusEnum } from "./expense.types";
import { CreateSharedExpenseInput } from "./expense.dto";

/**
 * Repository interface - defines data access contract
 */
export interface ISharedExpenseRepository {
  createExpense(input: CreateSharedExpenseInput): Promise<PrismaSharedExpense>;
  getExpenseById(id: string): Promise<PrismaSharedExpense | null>;
  getExpensesByCreator(creatorId: string, limit: number, offset: number): Promise<{ expenses: PrismaSharedExpense[]; total: number }>;
  getExpensesByParticipant(userId: string, limit: number, offset: number): Promise<{ expenses: PrismaSharedExpense[]; total: number }>;
  updateExpense(id: string, data: Partial<CreateSharedExpenseInput>): Promise<PrismaSharedExpense>;
  deleteExpense(id: string): Promise<boolean>;
  getExpenseSettlementStatus(id: string): Promise<SettlementStatusEnum>;
}

/**
 * Shared expense repository - implements data access operations
 */
export class SharedExpenseRepository implements ISharedExpenseRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Creates a new shared expense with participants
   *
   * @param input - Expense creation input
   * @returns The created expense
   * @throws {ExpenseDatabaseException} If database operation fails
   */
  async createExpense(input: CreateSharedExpenseInput): Promise<PrismaSharedExpense> {
    try {
      return await this.prisma.sharedExpense.create({
        data: {
          creatorId: input.creatorId,
          description: input.description,
          totalAmount: new Decimal(input.totalAmount),
          splitType: input.splitType,
          category: input.category,
          notes: input.notes,
          expenseDate: input.expenseDate,
          status: SettlementStatusEnum.PENDING,
          participants: {
            create: input.participantIds.map((userId) => ({
              userId,
              owedAmount: new Decimal(0), // Placeholder, should be calculated by service
              paidAmount: new Decimal(0),
            })),
          },
        },
        include: {
          participants: true,
        },
      });
    } catch (error) {
      throw new ExpenseDatabaseException("createExpense", error as Error);
    }
  }

  /**
   * Retrieves a shared expense by ID
   *
   * @param id - The expense ID
   * @returns The expense with participants and settlements
   * @throws {ExpenseDatabaseException} If database operation fails
   */
  async getExpenseById(id: string): Promise<PrismaSharedExpense | null> {
    try {
      return await this.prisma.sharedExpense.findUnique({
        where: { id },
        include: {
          participants: true,
          settlements: true,
        },
      });
    } catch (error) {
      throw new ExpenseDatabaseException("getExpenseById", error as Error);
    }
  }

  /**
   * Retrieves expenses created by a user with pagination
   *
   * @param creatorId - The creator user ID
   * @param limit - Maximum results
   * @param offset - Result offset
   * @returns Expenses and total count
   * @throws {ExpenseDatabaseException} If database operation fails
   */
  async getExpensesByCreator(
    creatorId: string,
    limit: number,
    offset: number
  ): Promise<{ expenses: PrismaSharedExpense[]; total: number }> {
    try {
      const [expenses, total] = await Promise.all([
        this.prisma.sharedExpense.findMany({
          where: { creatorId },
          include: {
            participants: true,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        this.prisma.sharedExpense.count({
          where: { creatorId },
        }),
      ]);

      return { expenses, total };
    } catch (error) {
      throw new ExpenseDatabaseException("getExpensesByCreator", error as Error);
    }
  }

  /**
   * Retrieves expenses where user is a participant with pagination
   *
   * @param userId - The participant user ID
   * @param limit - Maximum results
   * @param offset - Result offset
   * @returns Expenses and total count
   * @throws {ExpenseDatabaseException} If database operation fails
   */
  async getExpensesByParticipant(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ expenses: PrismaSharedExpense[]; total: number }> {
    try {
      const [expenses, total] = await Promise.all([
        this.prisma.sharedExpense.findMany({
          where: {
            participants: {
              some: {
                userId,
              },
            },
          },
          include: {
            participants: true,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        this.prisma.sharedExpense.count({
          where: {
            participants: {
              some: {
                userId,
              },
            },
          },
        }),
      ]);

      return { expenses, total };
    } catch (error) {
      throw new ExpenseDatabaseException("getExpensesByParticipant", error as Error);
    }
  }

  /**
   * Updates a shared expense
   *
   * @param id - The expense ID
   * @param data - Partial update data
   * @returns Updated expense
   * @throws {ExpenseDatabaseException} If database operation fails
   */
  async updateExpense(
    id: string,
    data: Partial<CreateSharedExpenseInput>
  ): Promise<PrismaSharedExpense> {
    try {
      return await this.prisma.sharedExpense.update({
        where: { id },
        data: {
          description: data.description,
          category: data.category,
          notes: data.notes,
          expenseDate: data.expenseDate,
        },
        include: {
          participants: true,
        },
      });
    } catch (error) {
      throw new ExpenseDatabaseException("updateExpense", error as Error);
    }
  }

  /**
   * Deletes a shared expense and all related records
   *
   * @param id - The expense ID
   * @returns true if deleted, false if not found
   * @throws {ExpenseDatabaseException} If database operation fails
   */
  async deleteExpense(id: string): Promise<boolean> {
    try {
      const result = await this.prisma.sharedExpense.delete({
        where: { id },
      });
      return !!result;
    } catch (error) {
      if ((error as any).code === "P2025") {
        return false; // Record not found
      }
      throw new ExpenseDatabaseException("deleteExpense", error as Error);
    }
  }

  /**
   * Determines the settlement status of an expense
   *
   * @param id - The expense ID
   * @returns Current settlement status
   * @throws {ExpenseDatabaseException} If database operation fails
   */
  async getExpenseSettlementStatus(id: string): Promise<SettlementStatusEnum> {
    try {
      const expense = await this.prisma.sharedExpense.findUnique({
        where: { id },
        include: {
          participants: true,
        },
      });

      if (!expense) {
        throw new Error(`Expense ${id} not found`);
      }

      // Check if all participants have paid their full share
      const allSettled = expense.participants.every(
        (p) => p.paidAmount.toString() === p.owedAmount.toString()
      );

      if (allSettled) {
        return SettlementStatusEnum.SETTLED;
      }

      // Check if any participant has paid
      const anyPaid = expense.participants.some(
        (p) => Number(p.paidAmount) > 0
      );

      if (anyPaid) {
        return SettlementStatusEnum.PARTIALLY_PAID;
      }

      return SettlementStatusEnum.PENDING;
    } catch (error) {
      throw new ExpenseDatabaseException("getExpenseSettlementStatus", error as Error);
    }
  }

  /**
   * Updates participant paid amount when settlement is recorded
   *
   * @param expenseId - The expense ID
   * @param userId - The participant user ID
   * @param amountPaid - Amount to add to paid total
   * @throws {ExpenseDatabaseException} If database operation fails
   */
  async updateParticipantPayment(
    expenseId: string,
    userId: string,
    amountPaid: number
  ): Promise<void> {
    try {
      await this.prisma.sharedExpenseParticipant.updateMany({
        where: {
          expenseId,
          userId,
        },
        data: {
          paidAmount: {
            increment: new Decimal(amountPaid),
          },
        },
      });
    } catch (error) {
      throw new ExpenseDatabaseException("updateParticipantPayment", error as Error);
    }
  }

  /**
   * Updates all participant owed amounts (after split recalculation)
   *
   * @param expenseId - The expense ID
   * @param splits - Map of userId to owed amount
   * @throws {ExpenseDatabaseException} If database operation fails
   */
  async updateParticipantOwedAmounts(
    expenseId: string,
    splits: Record<string, number>
  ): Promise<void> {
    try {
      for (const [userId, amount] of Object.entries(splits)) {
        await this.prisma.sharedExpenseParticipant.updateMany({
          where: {
            expenseId,
            userId,
          },
          data: {
            owedAmount: new Decimal(amount),
          },
        });
      }
    } catch (error) {
      throw new ExpenseDatabaseException("updateParticipantOwedAmounts", error as Error);
    }
  }
}
