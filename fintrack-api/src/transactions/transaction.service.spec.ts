/**
 * Transaction Service - Unit Tests
 *
 * Tests for TransactionService business logic layer.
 * These tests focus on:
 * - Business rule enforcement
 * - Error handling and exception throwing
 * - Logging and observability
 * - Proper delegation to repository
 */

import { TransactionService } from "./transaction.service";
import { TransactionRepository } from "./transaction.repository";
import { Logger } from "../logger";
import { TransactionTypeEnum, TransactionStatusEnum, RequestContext } from "./transaction.types";
import { Decimal } from "@prisma/client/runtime/library";
import {
  TransactionUnauthorizedException,
  TransactionDatabaseException,
} from "./transaction.exceptions";

describe("TransactionService", () => {
  let service: TransactionService;
  let repository: jest.Mocked<TransactionRepository>;
  let logger: jest.Mocked<Logger>;
  let mockContext: RequestContext;

  beforeEach(() => {
    // Mock repository
    repository = {
      create: jest.fn(),
      getByUserId: jest.fn(),
      getById: jest.fn(),
      deleteAllByUserId: jest.fn(),
      delete: jest.fn(),
    } as any;

    // Mock logger
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // Create service with mocked dependencies
    service = new TransactionService(repository, logger);

    // Mock request context
    mockContext = {
      requestId: "req-123",
      authenticatedUserId: "550e8400-e29b-41d4-a716-446655440000",
      timestamp: new Date(),
    };
  });

  describe("createTransaction", () => {
    it("should create a transaction successfully", async () => {
      // Arrange
      const mockTransaction = {
        id: "tx-123",
        userId: "550e8400-e29b-41d4-a716-446655440000",
        amount: new Decimal("100.00"),
        description: "Test transfer",
        type: TransactionTypeEnum.TRANSFER,
        status: TransactionStatusEnum.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.create.mockResolvedValue(mockTransaction as any);

      // Act
      const result = await service.createTransaction(mockContext, {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        amount: 100.00,
        type: TransactionTypeEnum.TRANSFER,
        description: "Test transfer",
      });

      // Assert
      expect(result.id).toBe("tx-123");
      expect(result.amount).toBe(100);
      expect(result.type).toBe(TransactionTypeEnum.TRANSFER);
      expect(result.status).toBe(TransactionStatusEnum.COMPLETED);
      expect(repository.create).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");
      const transactionError = new TransactionDatabaseException("create", dbError);
      repository.create.mockRejectedValue(transactionError);

      // Act & Assert
      await expect(
        service.createTransaction(mockContext, {
          userId: "550e8400-e29b-41d4-a716-446655440000",
          amount: 100.00,
          type: TransactionTypeEnum.TRANSFER,
        })
      ).rejects.toThrow(TransactionDatabaseException);

      expect(logger.error).toHaveBeenCalled();
    });

    it("should log transaction creation with proper context", async () => {
      // Arrange
      const mockTransaction = {
        id: "tx-123",
        userId: "550e8400-e29b-41d4-a716-446655440000",
        amount: new Decimal("50.25"),
        description: null,
        type: TransactionTypeEnum.DEPOSIT,
        status: TransactionStatusEnum.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      repository.create.mockResolvedValue(mockTransaction as any);

      // Act
      await service.createTransaction(mockContext, {
        userId: "550e8400-e29b-41d4-a716-446655440000",
        amount: 50.25,
        type: TransactionTypeEnum.DEPOSIT,
      });

      // Assert
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "req-123",
          userId: "550e8400-e29b-41d4-a716-446655440000",
          action: "CreateTransaction",
          transactionId: "tx-123",
          amount: "50.25",
          type: TransactionTypeEnum.DEPOSIT,
        })
      );
    });
  });

  describe("getTransactionsByUser", () => {
    it("should return paginated transactions for user", async () => {
      // Arrange
      const mockTransactions = [
        {
          id: "tx-1",
          userId: "550e8400-e29b-41d4-a716-446655440000",
          amount: new Decimal("100"),
          type: TransactionTypeEnum.TRANSFER,
          status: TransactionStatusEnum.COMPLETED,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "tx-2",
          userId: "550e8400-e29b-41d4-a716-446655440000",
          amount: new Decimal("50"),
          type: TransactionTypeEnum.DEPOSIT,
          status: TransactionStatusEnum.COMPLETED,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      repository.getByUserId.mockResolvedValue({
        transactions: mockTransactions as any,
        total: 150,
      });

      // Act
      const result = await service.getTransactionsByUser(
        mockContext,
        "550e8400-e29b-41d4-a716-446655440000",
        { limit: 100, offset: 0 }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(150);
      expect(result.pagination.hasMore).toBe(true);
      expect(repository.getByUserId).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
        100,
        0
      );
    });

    it("should throw unauthorized exception when user tries to access other user's transactions", async () => {
      // Arrange
      const otherUserId = "650e8400-e29b-41d4-a716-446655440001";

      // Act & Assert
      await expect(
        service.getTransactionsByUser(mockContext, otherUserId, {
          limit: 100,
          offset: 0,
        })
      ).rejects.toThrow(TransactionUnauthorizedException);

      expect(logger.warn).toHaveBeenCalled();
    });

    it("should handle pagination correctly", async () => {
      // Arrange
      repository.getByUserId.mockResolvedValue({
        transactions: [] as any,
        total: 250,
      });

      // Act
      const result = await service.getTransactionsByUser(
        mockContext,
        "550e8400-e29b-41d4-a716-446655440000",
        { limit: 100, offset: 100 }
      );

      // Assert
      expect(result.pagination.offset).toBe(100);
      expect(result.pagination.limit).toBe(100);
      expect(result.pagination.hasMore).toBe(true);
    });

    it("should set hasMore to false when at end of results", async () => {
      // Arrange
      repository.getByUserId.mockResolvedValue({
        transactions: [] as any,
        total: 100,
      });

      // Act
      const result = await service.getTransactionsByUser(
        mockContext,
        "550e8400-e29b-41d4-a716-446655440000",
        { limit: 100, offset: 0 }
      );

      // Assert
      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe("deleteAllTransactionsByUser", () => {
    it("should delete all transactions for user", async () => {
      // Arrange
      repository.deleteAllByUserId.mockResolvedValue(150);

      // Act
      const deletedCount = await service.deleteAllTransactionsByUser(
        mockContext,
        "550e8400-e29b-41d4-a716-446655440000"
      );

      // Assert
      expect(deletedCount).toBe(150);
      expect(repository.deleteAllByUserId).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000"
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "DeleteAllTransactionsByUser",
          deletedCount: 150,
          severity: "HIGH",
        })
      );
    });

    it("should throw unauthorized exception when user tries to delete other user's transactions", async () => {
      // Arrange
      const otherUserId = "650e8400-e29b-41d4-a716-446655440001";

      // Act & Assert
      await expect(
        service.deleteAllTransactionsByUser(mockContext, otherUserId)
      ).rejects.toThrow(TransactionUnauthorizedException);

      expect(logger.warn).toHaveBeenCalled();
    });

    it("should log warning when deleting transactions due to data loss severity", async () => {
      // Arrange
      repository.deleteAllByUserId.mockResolvedValue(75);

      // Act
      await service.deleteAllTransactionsByUser(
        mockContext,
        "550e8400-e29b-41d4-a716-446655440000"
      );

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: "HIGH",
          message: "All user transactions deleted",
        })
      );
    });

    it("should handle database errors during deletion", async () => {
      // Arrange
      const dbError = new Error("Database deletion failed");
      const transactionError = new TransactionDatabaseException(
        "deleteAllByUserId",
        dbError
      );
      repository.deleteAllByUserId.mockRejectedValue(transactionError);

      // Act & Assert
      await expect(
        service.deleteAllTransactionsByUser(
          mockContext,
          "550e8400-e29b-41d4-a716-446655440000"
        )
      ).rejects.toThrow(TransactionDatabaseException);

      expect(logger.error).toHaveBeenCalled();
    });
  });
});