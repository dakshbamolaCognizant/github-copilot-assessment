import { Logger } from "../logger";
import { TransactionRepository, CreateTransactionInput } from "./transaction.model";
import { Transaction, TransactionType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface TransactionResponse {
  id: string;
  userId: string;
  amount: number;
  description?: string;
  type: TransactionType;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}
export class TransactionService {
  constructor(
    private repository: TransactionRepository,
    private logger: Logger
  ) {}

  async createTransaction(
    userId: string,
    amount: number,
    type: TransactionType,
    description?: string
  ): Promise<TransactionResponse> {
    if (!userId || !amount || amount <= 0) {
      this.logger.warn({
        requestId: "",
        userId,
        action: "CreateTransaction",
        reason: "Invalid input",
      });
      throw new Error("Invalid transaction input");
    }
    try {
      const transaction = await this.repository.create({
        userId,
        amount: new Decimal(amount),
        type,
        description,
      });

      this.logger.info({
        requestId: "",
        userId,
        action: "CreateTransaction",
        transactionId: transaction.id,
      });
      return this.mapToResponse(transaction);
    } catch (error) {
      this.logger.error({
        requestId: "",
        userId,
        action: "CreateTransaction",
        error: String(error),
      });
      throw error;
    }
  }

  async getTransactionsByUser(userId: string): Promise<TransactionResponse[]> {
    try {
      const transactions = await this.repository.getByUserId(userId);
      this.logger.info({
        requestId: "",
        userId,
        action: "GetTransactionsByUser",
        count: transactions.length,
      });
      return transactions.map((t) => this.mapToResponse(t));
    } catch (error) {
      this.logger.error({
        requestId: "",
        userId,
        action: "GetTransactionsByUser",
        error: String(error),
      });
      throw error;
    }
  }

  async deleteAllTransactionsByUser(userId: string): Promise<number> {
    try {
      const count = await this.repository.deleteAllByUserId(userId);

      this.logger.info({
        requestId: "",
        userId,
        action: "DeleteAllTransactions",
        deletedCount: count,
      });

      return count;
    } catch (error) {
      this.logger.error({
        requestId: "",
        userId,
        action: "DeleteAllTransactions",
        error: String(error),
      });
      throw error;
    }
  }

  private mapToResponse(transaction: Transaction): TransactionResponse {
    return {
      id: transaction.id,
      userId: transaction.userId,
      amount: Number(transaction.amount),
      description: transaction.description || undefined,
      type: transaction.type,
      status: transaction.status,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}