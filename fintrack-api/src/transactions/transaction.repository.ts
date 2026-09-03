/**
 * Transaction Module - Repository Layer
 *
 * The repository layer handles all database interactions using Prisma ORM.
 * This layer is responsible for:
 * - Creating, reading, updating, and deleting transactions
 * - Executing database queries with proper error handling
 * - Managing database transactions for financial operations
 *
 * @module transactions/repository
 */

import { PrismaClient, Transaction as PrismaTransaction } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { TransactionDatabaseException } from "./transaction.exceptions";
import { TransactionStatusEnum } from "./transaction.types";
import { CreateTransactionInput } from "./transaction.dto";

/**
 * Repository interface - defines contract for transaction persistence
 */
export interface ITransactionRepository {
  create(input: CreateTransactionInput, status?: TransactionStatusEnum): Promise<PrismaTransaction>;
  getByUserId(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ transactions: PrismaTransaction[]; total: number }>;
  getById(id: string): Promise<PrismaTransaction | null>;
  deleteAllByUserId(userId: string): Promise<number>;
  delete(id: string): Promise<boolean>;
}

/**
 * Transaction repository - implements data access operations
 * Uses Prisma Client for all database interactions
 */
export class TransactionRepository implements ITransactionRepository {
  /**
   * Creates a new TransactionRepository instance
   *
   * @param prisma - Prisma Client instance
   */
  constructor(private prisma: PrismaClient) {}

  /**
   * Creates a new transaction in the database
   *
   * @param input - Transaction input data
   * @param status - Initial status (defaults to COMPLETED)
   * @returns The created transaction
   * @throws {TransactionDatabaseException} If database operation fails
   */
  async create(
    input: CreateTransactionInput,
    status: TransactionStatusEnum = TransactionStatusEnum.COMPLETED
  ): Promise<PrismaTransaction> {
    try {
      return await this.prisma.transaction.create({
        data: {
          userId: input.userId,
          amount: new Decimal(input.amount),
          type: input.type,
          description: input.description || null,
          status,
        },
      });
    } catch (error) {
      throw new TransactionDatabaseException("create", error as Error);
    }
  }

  /**
   * Retrieves transactions for a user with pagination
   *
   * @param userId - The user ID to query
   * @param limit - Maximum number of results (pagination limit)
   * @param offset - Number of results to skip (pagination offset)
   * @returns Object containing transactions array and total count
   * @throws {TransactionDatabaseException} If database operation fails
   */
  async getByUserId(
    userId: string,
    limit: number,
    offset: number
  ): Promise<{ transactions: PrismaTransaction[]; total: number }> {
    try {
      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        }),
        this.prisma.transaction.count({
          where: { userId },
        }),
      ]);

      return { transactions, total };
    } catch (error) {
      throw new TransactionDatabaseException("getByUserId", error as Error);
    }
  }

  /**
   * Retrieves a single transaction by ID
   *
   * @param id - The transaction ID
   * @returns The transaction or null if not found
   * @throws {TransactionDatabaseException} If database operation fails
   */
  async getById(id: string): Promise<PrismaTransaction | null> {
    try {
      return await this.prisma.transaction.findUnique({
        where: { id },
      });
    } catch (error) {
      throw new TransactionDatabaseException("getById", error as Error);
    }
  }

  /**
   * Deletes all transactions for a user
   *
   * @param userId - The user ID
   * @returns Number of deleted transactions
   * @throws {TransactionDatabaseException} If database operation fails
   */
  async deleteAllByUserId(userId: string): Promise<number> {
    try {
      const result = await this.prisma.transaction.deleteMany({
        where: { userId },
      });
      return result.count;
    } catch (error) {
      throw new TransactionDatabaseException("deleteAllByUserId", error as Error);
    }
  }

  /**
   * Deletes a single transaction by ID
   *
   * @param id - The transaction ID
   * @returns true if deleted, false if not found
   * @throws {TransactionDatabaseException} If database operation fails
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.prisma.transaction.delete({
        where: { id },
      });
      return !!result;
    } catch (error) {
      // Handle case where record doesn't exist
      if ((error as any).code === "P2025") {
        return false;
      }
      throw new TransactionDatabaseException("delete", error as Error);
    }
  }
}
