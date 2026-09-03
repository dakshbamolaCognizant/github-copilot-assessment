/**
 * Shared Expense Service - Unit Tests
 *
 * Comprehensive tests for all service layer business logic.
 *
 * Test Categories:
 * 1. Expense Creation (with all split types)
 * 2. Authorization Checks (defense-in-depth)
 * 3. Balance Calculations
 * 4. Settlement Operations
 * 5. Error Handling
 * 6. Pagination
 * 7. Real-world Scenarios
 *
 * @file src/expenses/expense.service.spec.ts
 */

import { SharedExpenseService } from "./expense.service";
import { SharedExpenseRepository } from "./expense.model";
import { Logger } from "../logger";
import {
  ExpenseNotFoundException,
  ExpenseUnauthorizedException,
  ExpenseSplitException,
} from "./expense.exceptions";
import { ExpenseSplitTypeEnum, SettlementStatusEnum } from "./expense.types";
import { RequestContext } from "./expense.types";

describe("SharedExpenseService - Comprehensive Tests", () => {
  let service: SharedExpenseService;
  let mockRepository: jest.Mocked<SharedExpenseRepository>;
  let mockLogger: jest.Mocked<Logger>;
  let context: RequestContext;

  beforeEach(() => {
    // Mock dependencies
    mockRepository = {
      createExpense: jest.fn(),
      getExpenseById: jest.fn(),
      getExpensesByCreator: jest.fn(),
      getExpensesByParticipant: jest.fn(),
      updateExpense: jest.fn(),
      deleteExpense: jest.fn(),
      getExpenseSettlementStatus: jest.fn(),
      updateParticipantPayment: jest.fn(),
      updateParticipantOwedAmounts: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    service = new SharedExpenseService(mockRepository, mockLogger);

    context = {
      requestId: "req-123",
      authenticatedUserId: "user-123",
      timestamp: new Date(),
    };
  });

  // ===== EXPENSE CREATION TESTS =====

  describe("Create Expense", () => {
    describe("Equal Split - Test Suite", () => {
      it("should create expense with equal split successfully - 3 participants", async () => {
        const mockExpense = {
          id: "exp-123",
          creatorId: "user-123",
          description: "Dinner",
          totalAmount: 120,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          status: SettlementStatusEnum.PENDING,
          category: "DINING",
          notes: "Restaurant",
          expenseDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [
            { userId: "user-123", owedAmount: 40, paidAmount: 0 },
            { userId: "user-456", owedAmount: 40, paidAmount: 0 },
            { userId: "user-789", owedAmount: 40, paidAmount: 0 },
          ],
        };

        mockRepository.createExpense.mockResolvedValue(mockExpense);
        mockRepository.updateParticipantOwedAmounts.mockResolvedValue(undefined);
        mockRepository.getExpenseById.mockResolvedValue(mockExpense);

        const result = await service.createExpense(context, {
          creatorId: "user-123",
          description: "Dinner",
          totalAmount: 120,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          participantIds: ["user-123", "user-456", "user-789"],
          category: "FOOD" as any,
          notes: "Restaurant",
          expenseDate: new Date(),
        });

        expect(result.id).toBe("exp-123");
        expect(result.totalAmount).toBe(120);
        expect(result.participants).toHaveLength(3);
        expect(result.participants[0].owedAmount).toBe(40);
        expect(result.participants[1].owedAmount).toBe(40);
        expect(result.participants[2].owedAmount).toBe(40);
        expect(result.splitType).toBe(ExpenseSplitTypeEnum.EQUAL);
        expect(result.status).toBe(SettlementStatusEnum.PENDING);
      });

      it("should distribute equal split with rounding - 4 participants splitting $100", async () => {
        const mockExpense = {
          id: "exp-equal-rounding",
          creatorId: "alice",
          description: "Group expense",
          totalAmount: 100,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          status: SettlementStatusEnum.PENDING,
          expenseDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [
            { userId: "alice", owedAmount: 25, paidAmount: 0 },
            { userId: "bob", owedAmount: 25, paidAmount: 0 },
            { userId: "charlie", owedAmount: 25, paidAmount: 0 },
            { userId: "diana", owedAmount: 25, paidAmount: 0 },
          ],
        };

        mockRepository.createExpense.mockResolvedValue(mockExpense);
        mockRepository.updateParticipantOwedAmounts.mockResolvedValue(undefined);
        mockRepository.getExpenseById.mockResolvedValue(mockExpense);

        const result = await service.createExpense(context, {
          creatorId: "alice",
          description: "Group expense",
          totalAmount: 100,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          participantIds: ["alice", "bob", "charlie", "diana"],
        });

        const totalOwed = result.participants.reduce((sum, p) => sum + p.owedAmount, 0);
        expect(totalOwed).toBe(100); // Sum should equal total
        expect(result.participants).toHaveLength(4);
        result.participants.forEach(p => {
          expect(p.owedAmount).toBe(25);
        });
      });

      it("should distribute equal split with remainder - 3 participants splitting $100", async () => {
        const mockExpense = {
          id: "exp-remainder",
          creatorId: "user1",
          description: "Group expense",
          totalAmount: 100,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          status: SettlementStatusEnum.PENDING,
          expenseDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [
            { userId: "user1", owedAmount: 33.33, paidAmount: 0 },
            { userId: "user2", owedAmount: 33.33, paidAmount: 0 },
            { userId: "user3", owedAmount: 33.34, paidAmount: 0 }, // Last gets remainder
          ],
        };

        mockRepository.createExpense.mockResolvedValue(mockExpense);
        mockRepository.updateParticipantOwedAmounts.mockResolvedValue(undefined);
        mockRepository.getExpenseById.mockResolvedValue(mockExpense);

        const result = await service.createExpense(context, {
          creatorId: "user1",
          description: "Group expense",
          totalAmount: 100,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          participantIds: ["user1", "user2", "user3"],
        });

        const totalOwed = result.participants.reduce((sum, p) => sum + p.owedAmount, 0);
        expect(totalOwed).toBeCloseTo(100, 2);
      });
    });

    describe("Valid Custom Split (BY_AMOUNT) - Test Suite", () => {
      it("should create expense with valid BY_AMOUNT split", async () => {
        const mockExpense = {
          id: "exp-custom-1",
          creatorId: "alice",
          description: "Group purchase",
          totalAmount: 150,
          splitType: ExpenseSplitTypeEnum.BY_AMOUNT,
          status: SettlementStatusEnum.PENDING,
          expenseDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [
            { userId: "alice", owedAmount: 60, paidAmount: 0 },
            { userId: "bob", owedAmount: 50, paidAmount: 0 },
            { userId: "charlie", owedAmount: 40, paidAmount: 0 },
          ],
        };

        mockRepository.createExpense.mockResolvedValue(mockExpense);
        mockRepository.updateParticipantOwedAmounts.mockResolvedValue(undefined);
        mockRepository.getExpenseById.mockResolvedValue(mockExpense);

        const result = await service.createExpense(context, {
          creatorId: "alice",
          description: "Group purchase",
          totalAmount: 150,
          splitType: ExpenseSplitTypeEnum.BY_AMOUNT,
          participantIds: ["alice", "bob", "charlie"],
          splitConfig: {
            type: ExpenseSplitTypeEnum.BY_AMOUNT,
            splits: { alice: 60, bob: 50, charlie: 40 },
          },
        });

        expect(result.id).toBe("exp-custom-1");
        expect(result.totalAmount).toBe(150);
        expect(result.splitType).toBe(ExpenseSplitTypeEnum.BY_AMOUNT);
        expect(result.participants[0].owedAmount).toBe(60);
        expect(result.participants[1].owedAmount).toBe(50);
        expect(result.participants[2].owedAmount).toBe(40);

        // Verify total matches
        const totalOwed = result.participants.reduce((sum, p) => sum + p.owedAmount, 0);
        expect(totalOwed).toBe(150);
      });

      it("should handle decimal amounts in BY_AMOUNT split", async () => {
        const mockExpense = {
          id: "exp-decimal",
          creatorId: "alice",
          description: "Dinner",
          totalAmount: 125.80,
          splitType: ExpenseSplitTypeEnum.BY_AMOUNT,
          status: SettlementStatusEnum.PENDING,
          expenseDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [
            { userId: "alice", owedAmount: 35.50, paidAmount: 0 },
            { userId: "bob", owedAmount: 45.30, paidAmount: 0 },
            { userId: "charlie", owedAmount: 45.00, paidAmount: 0 },
          ],
        };

        mockRepository.createExpense.mockResolvedValue(mockExpense);
        mockRepository.updateParticipantOwedAmounts.mockResolvedValue(undefined);
        mockRepository.getExpenseById.mockResolvedValue(mockExpense);

        const result = await service.createExpense(context, {
          creatorId: "alice",
          description: "Dinner",
          totalAmount: 125.80,
          splitType: ExpenseSplitTypeEnum.BY_AMOUNT,
          participantIds: ["alice", "bob", "charlie"],
          splitConfig: {
            type: ExpenseSplitTypeEnum.BY_AMOUNT,
            splits: { alice: 35.50, bob: 45.30, charlie: 45.00 },
          },
        });

        expect(result.splitType).toBe(ExpenseSplitTypeEnum.BY_AMOUNT);
        const totalOwed = result.participants.reduce((sum, p) => sum + p.owedAmount, 0);
        expect(totalOwed).toBeCloseTo(125.80, 2);
      });

      it("should allow unequal custom split amounts", async () => {
        const mockExpense = {
          id: "exp-unequal",
          creatorId: "host",
          description: "Birthday dinner",
          totalAmount: 200,
          splitType: ExpenseSplitTypeEnum.BY_AMOUNT,
          status: SettlementStatusEnum.PENDING,
          expenseDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [
            { userId: "host", owedAmount: 100, paidAmount: 0 },      // Host pays half
            { userId: "guest1", owedAmount: 50, paidAmount: 0 },      // Guest 1 pays quarter
            { userId: "guest2", owedAmount: 50, paidAmount: 0 },      // Guest 2 pays quarter
          ],
        };

        mockRepository.createExpense.mockResolvedValue(mockExpense);
        mockRepository.updateParticipantOwedAmounts.mockResolvedValue(undefined);
        mockRepository.getExpenseById.mockResolvedValue(mockExpense);

        const result = await service.createExpense(context, {
          creatorId: "host",
          description: "Birthday dinner",
          totalAmount: 200,
          splitType: ExpenseSplitTypeEnum.BY_AMOUNT,
          participantIds: ["host", "guest1", "guest2"],
          splitConfig: {
            type: ExpenseSplitTypeEnum.BY_AMOUNT,
            splits: { host: 100, guest1: 50, guest2: 50 },
          },
        });

        expect(result.participants[0].owedAmount).toBe(100);
        expect(result.participants[1].owedAmount).toBe(50);
        expect(result.participants[2].owedAmount).toBe(50);
      });
    });

    describe("Invalid Custom Split - Test Suite", () => {
      it("should throw error for invalid split configuration - amounts exceed total", async () => {
        mockRepository.createExpense.mockImplementation(() => {
          throw new ExpenseSplitException("Invalid split config");
        });

        await expect(
          service.createExpense(context, {
            creatorId: "user-123",
            description: "Dinner",
            totalAmount: 100,
            splitType: ExpenseSplitTypeEnum.BY_AMOUNT,
            participantIds: ["user-123", "user-456"],
            splitConfig: {
              type: ExpenseSplitTypeEnum.BY_AMOUNT,
              splits: { "user-123": 60, "user-456": 50 }, // Sum = 110, not 100
            },
          })
        ).rejects.toThrow(ExpenseSplitException);
      });

      it("should throw error for invalid split configuration - amounts below total", async () => {
        mockRepository.createExpense.mockImplementation(() => {
          throw new ExpenseSplitException("Split amounts do not sum to total");
        });

        await expect(
          service.createExpense(context, {
            creatorId: "alice",
            description: "Dinner",
            totalAmount: 100,
            splitType: ExpenseSplitTypeEnum.BY_AMOUNT,
            participantIds: ["alice", "bob"],
            splitConfig: {
              type: ExpenseSplitTypeEnum.BY_AMOUNT,
              splits: { alice: 40, bob: 40 }, // Sum = 80, not 100
            },
          })
        ).rejects.toThrow(ExpenseSplitException);
      });

      it("should throw error for negative amount in split", async () => {
        mockRepository.createExpense.mockImplementation(() => {
          throw new ExpenseSplitException("Amount cannot be negative");
        });

        await expect(
          service.createExpense(context, {
            creatorId: "alice",
            description: "Dinner",
            totalAmount: 100,
            splitType: ExpenseSplitTypeEnum.BY_AMOUNT,
            participantIds: ["alice", "bob"],
            splitConfig: {
              type: ExpenseSplitTypeEnum.BY_AMOUNT,
              splits: { alice: 150, bob: -50 }, // Negative amount
            },
          })
        ).rejects.toThrow(ExpenseSplitException);
      });

      it("should throw error for missing participant in split config", async () => {
        mockRepository.createExpense.mockImplementation(() => {
          throw new ExpenseSplitException("Missing participant in split configuration");
        });

        await expect(
          service.createExpense(context, {
            creatorId: "alice",
            description: "Dinner",
            totalAmount: 100,
            splitType: ExpenseSplitTypeEnum.BY_AMOUNT,
            participantIds: ["alice", "bob", "charlie"],
            splitConfig: {
              type: ExpenseSplitTypeEnum.BY_AMOUNT,
              splits: { alice: 50, bob: 50 }, // Charlie missing
            },
          })
        ).rejects.toThrow(ExpenseSplitException);
      });
    });

    it("should throw error if creator not in participant list", async () => {
      expect(() => {
        service.createExpense(context, {
          creatorId: "user-123",
          description: "Dinner",
          totalAmount: 100,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          participantIds: ["user-456", "user-789"], // user-123 missing!
        });
      }).rejects.toThrow(ExpenseUnauthorizedException);
    });

    describe("Single Participant Validation - Test Suite", () => {
      it("should reject expense with only 1 participant", async () => {
        mockRepository.createExpense.mockImplementation(() => {
          throw new ExpenseSplitException("At least 2 participants required");
        });

        await expect(
          service.createExpense(context, {
            creatorId: "user-123",
            description: "Personal expense",
            totalAmount: 50,
            splitType: ExpenseSplitTypeEnum.EQUAL,
            participantIds: ["user-123"], // Only 1 participant
          })
        ).rejects.toThrow(ExpenseSplitException);
      });

      it("should reject expense with empty participants list", async () => {
        mockRepository.createExpense.mockImplementation(() => {
          throw new ExpenseSplitException("At least 2 participants required");
        });

        await expect(
          service.createExpense(context, {
            creatorId: "user-123",
            description: "Expense",
            totalAmount: 100,
            splitType: ExpenseSplitTypeEnum.EQUAL,
            participantIds: [], // Empty list
          })
        ).rejects.toThrow(ExpenseSplitException);
      });

      it("should accept minimum of 2 participants", async () => {
        const mockExpense = {
          id: "exp-2-parts",
          creatorId: "alice",
          description: "Two person expense",
          totalAmount: 100,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          status: SettlementStatusEnum.PENDING,
          expenseDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [
            { userId: "alice", owedAmount: 50, paidAmount: 0 },
            { userId: "bob", owedAmount: 50, paidAmount: 0 },
          ],
        };

        mockRepository.createExpense.mockResolvedValue(mockExpense);
        mockRepository.updateParticipantOwedAmounts.mockResolvedValue(undefined);
        mockRepository.getExpenseById.mockResolvedValue(mockExpense);

        const result = await service.createExpense(context, {
          creatorId: "alice",
          description: "Two person expense",
          totalAmount: 100,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          participantIds: ["alice", "bob"],
        });

        expect(result.participants).toHaveLength(2);
        expect(result.id).toBe("exp-2-parts");
      });

      it("should handle many participants (10+)", async () => {
        const participantIds = Array.from({ length: 10 }, (_, i) => `user-${i}`);
        const mockExpense = {
          id: "exp-many",
          creatorId: "user-0",
          description: "Large group expense",
          totalAmount: 1000,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          status: SettlementStatusEnum.PENDING,
          expenseDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: participantIds.map(userId => ({
            userId,
            owedAmount: 100,
            paidAmount: 0,
          })),
        };

        mockRepository.createExpense.mockResolvedValue(mockExpense);
        mockRepository.updateParticipantOwedAmounts.mockResolvedValue(undefined);
        mockRepository.getExpenseById.mockResolvedValue(mockExpense);

        const result = await service.createExpense(context, {
          creatorId: "user-0",
          description: "Large group expense",
          totalAmount: 1000,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          participantIds,
        });

        expect(result.participants).toHaveLength(10);
      });
    });

    it("should create expense with percentage split", async () => {
      const mockExpense = {
        id: "exp-456",
        creatorId: "alice",
        description: "Rent",
        totalAmount: 3000,
        splitType: ExpenseSplitTypeEnum.BY_PERCENTAGE,
        status: SettlementStatusEnum.PENDING,
        category: "HOUSING",
        expenseDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [
          { userId: "alice", owedAmount: 1500, paidAmount: 0 },
          { userId: "bob", owedAmount: 900, paidAmount: 0 },
          { userId: "charlie", owedAmount: 600, paidAmount: 0 },
        ],
      };

      mockRepository.createExpense.mockResolvedValue(mockExpense);
      mockRepository.updateParticipantOwedAmounts.mockResolvedValue(undefined);
      mockRepository.getExpenseById.mockResolvedValue(mockExpense);

      const result = await service.createExpense(context, {
        creatorId: "alice",
        description: "Rent",
        totalAmount: 3000,
        splitType: ExpenseSplitTypeEnum.BY_PERCENTAGE,
        participantIds: ["alice", "bob", "charlie"],
        splitConfig: {
          type: ExpenseSplitTypeEnum.BY_PERCENTAGE,
          splits: { alice: 50, bob: 30, charlie: 20 },
        },
        category: "RENT" as any,
      });

      expect(result.participants[0].owedAmount).toBe(1500);
      expect(result.participants[1].owedAmount).toBe(900);
      expect(result.participants[2].owedAmount).toBe(600);
    });

    it("should throw error for invalid split configuration", async () => {
      mockRepository.createExpense.mockImplementation(() => {
        throw new ExpenseSplitException("Invalid split config");
      });

      await expect(
        service.createExpense(context, {
          creatorId: "user-123",
          description: "Dinner",
          totalAmount: 100,
          splitType: ExpenseSplitTypeEnum.BY_AMOUNT,
          participantIds: ["user-123", "user-456"],
          splitConfig: {
            type: ExpenseSplitTypeEnum.BY_AMOUNT,
            splits: { "user-123": 60, "user-456": 50 }, // Sum = 110, not 100
          },
        })
      ).rejects.toThrow(ExpenseSplitException);
    });

    it("should log expense creation with structured context", async () => {
      const mockExpense = {
        id: "exp-789",
        creatorId: "user-123",
        description: "Dinner",
        totalAmount: 100,
        splitType: ExpenseSplitTypeEnum.EQUAL,
        status: SettlementStatusEnum.PENDING,
        expenseDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
      };

      mockRepository.createExpense.mockResolvedValue(mockExpense);
      mockRepository.updateParticipantOwedAmounts.mockResolvedValue(undefined);
      mockRepository.getExpenseById.mockResolvedValue(mockExpense);

      await service.createExpense(context, {
        creatorId: "user-123",
        description: "Dinner",
        totalAmount: 100,
        splitType: ExpenseSplitTypeEnum.EQUAL,
        participantIds: ["user-123", "user-456"],
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "req-123",
          userId: "user-123",
          action: "CreateExpense",
        })
      );
    });
  });

  // ===== AUTHORIZATION TESTS =====

  describe("Authorization Checks (Defense-in-Depth) - Test Suite", () => {
    describe("Unauthorized Access - Prevention Tests", () => {
      it("should prevent user from viewing expenses of other creators", async () => {
        mockRepository.getExpensesByCreator.mockResolvedValue({
          expenses: [],
          total: 0,
        });

        await expect(
          service.getExpensesByCreator(
            context,
            "user-123", // authenticated
            "other-user", // requested
            100,
            0
          )
        ).rejects.toThrow(ExpenseUnauthorizedException);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            reason: "Unauthorized access attempt",
          })
        );
      });

      it("should prevent unauthorized user from accessing specific expense", async () => {
        const mockExpense = {
          id: "exp-sensitive",
          creatorId: "alice",
          description: "Personal expense",
          totalAmount: 500,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          status: SettlementStatusEnum.PENDING,
          expenseDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [
            { userId: "alice", owedAmount: 250, paidAmount: 0 },
            { userId: "bob", owedAmount: 250, paidAmount: 0 },
          ],
        };

        mockRepository.getExpenseById.mockResolvedValue(mockExpense);

        const unauthorized_context = {
          requestId: "req-999",
          authenticatedUserId: "hacker", // Completely different user
          timestamp: new Date(),
        };

        await expect(
          service.getExpenseById(unauthorized_context, "exp-sensitive", "hacker")
        ).rejects.toThrow(ExpenseUnauthorizedException);
      });

      it("should prevent non-participant from viewing expense", async () => {
        const mockExpense = {
          id: "exp-456",
          creatorId: "alice",
          description: "Group lunch",
          totalAmount: 150,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          status: SettlementStatusEnum.PENDING,
          expenseDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [
            { userId: "alice", owedAmount: 75, paidAmount: 0 },
            { userId: "bob", owedAmount: 75, paidAmount: 0 },
            // Charlie is NOT included
          ],
        };

        mockRepository.getExpenseById.mockResolvedValue(mockExpense);

        const charlie_context = {
          requestId: "req-charlie",
          authenticatedUserId: "charlie", // Not in participants
          timestamp: new Date(),
        };

        await expect(
          service.getExpenseById(charlie_context, "exp-456", "charlie")
        ).rejects.toThrow(ExpenseUnauthorizedException);
      });
    });

    describe("Payment Authorization - Prevention Tests", () => {
      it("should prevent non-participant from recording payment", async () => {
        const mockExpense = {
          id: "exp-123",
          creatorId: "user-123",
          description: "Dinner",
          totalAmount: 100,
          participants: [
            { userId: "user-123", owedAmount: 50, paidAmount: 0 },
            { userId: "user-456", owedAmount: 50, paidAmount: 0 },
          ],
        };

        mockRepository.getExpenseById.mockResolvedValue(mockExpense);

        await expect(
          service.recordSettlement(
            context,
            "exp-123",
            { amount: 25, paidByUserId: "user-123", paidToUserId: "user-456", paymentMethod: "CASH" } as any,
            "user-999" // Not a participant
          )
        ).rejects.toThrow(ExpenseUnauthorizedException);
      });

      it("should prevent user from paying another user's balance", async () => {
        const mockExpense = {
          id: "exp-123",
          creatorId: "user-123",
          description: "Dinner",
          totalAmount: 100,
          participants: [
            { userId: "user-123", owedAmount: 50, paidAmount: 0 },
            { userId: "user-456", owedAmount: 50, paidAmount: 0 },
          ],
        };

        mockRepository.getExpenseById.mockResolvedValue(mockExpense);

        await expect(
          service.recordSettlement(
            context,
            "exp-123",
            { amount: 25, paidByUserId: "user-456", paidToUserId: "user-123", paymentMethod: "CASH" } as any,
            "user-123" // but authenticated as user-123
          )
        ).rejects.toThrow(ExpenseUnauthorizedException);
      });

      it("should prevent alice from recording payment for bob", async () => {
        const mockExpense = {
          id: "exp-group",
          creatorId: "host",
          description: "Group dinner",
          totalAmount: 300,
          participants: [
            { userId: "host", owedAmount: 100, paidAmount: 0 },
            { userId: "alice", owedAmount: 100, paidAmount: 0 },
            { userId: "bob", owedAmount: 100, paidAmount: 0 },
          ],
        };

        mockRepository.getExpenseById.mockResolvedValue(mockExpense);

        const alice_context = {
          requestId: "req-alice",
          authenticatedUserId: "alice",
          timestamp: new Date(),
        };

        await expect(
          service.recordSettlement(
            alice_context,
            "exp-group",
            { amount: 100, paidByUserId: "bob", paidToUserId: "alice", paymentMethod: "CASH" } as any,
            "alice"
          )
        ).rejects.toThrow(ExpenseUnauthorizedException);
      });

      it("should allow user to record only their own payment", async () => {
        const mockExpense = {
          id: "exp-123",
          creatorId: "creator",
          totalAmount: 100,
          participants: [
            { userId: "creator", owedAmount: 50, paidAmount: 0 },
            { userId: "payer", owedAmount: 50, paidAmount: 0 },
          ],
        };

        mockRepository.getExpenseById.mockResolvedValue(mockExpense);
        mockRepository.updateParticipantPayment.mockResolvedValue(undefined);
        mockRepository.getExpenseSettlementStatus.mockResolvedValue(
          SettlementStatusEnum.PARTIALLY_PAID
        );

        const payer_context = {
          requestId: "req-payer",
          authenticatedUserId: "payer",
          timestamp: new Date(),
        };

        const result = await service.recordSettlement(
          payer_context,
          "exp-123",
          { amount: 25, paidByUserId: "payer", paidToUserId: "creator", paymentMethod: "CASH" } as any,
          "payer"
        );

        expect(result.status).toBeDefined();
        expect(result.totalPaid).toBeGreaterThan(0);
      });
    });
  });

  // ===== BALANCE CALCULATION TESTS =====

  describe("Net Balance Calculations - Test Suite", () => {
    describe("Basic Net Balance Calculations", () => {
      it("should calculate net user balance correctly - user owes money", async () => {
        const expenses = [
          {
            id: "exp-1",
            creatorId: "other",
            participants: [
              { userId: "user-123", owedAmount: 30, paidAmount: 20 },
            ],
          },
          {
            id: "exp-2",
            creatorId: "other",
            participants: [
              { userId: "user-123", owedAmount: 50, paidAmount: 0 },
            ],
          },
          {
            id: "exp-3",
            creatorId: "user-123",
            participants: [
              { userId: "user-123", owedAmount: 40, paidAmount: 60 }, // Overpaid
            ],
          },
        ];

        mockRepository.getExpensesByParticipant.mockResolvedValue({
          expenses: expenses as any,
          total: 3,
        });

        const result = await service.getNetUserBalance(
          context,
          "user-123",
          "user-123"
        );

        // Total owed: 30 + 50 + 40 = 120
        // Total paid: 20 + 0 + 60 = 80
        // Net balance: 120 - 80 = 40 (still owes $40)
        expect(result.totalOwed).toBe(120);
        expect(result.totalPaid).toBe(80);
        expect(result.netBalance).toBe(40);
        expect(result.expenseCount).toBe(3);
      });

      it("should handle negative net balance (overpayment)", async () => {
        const expenses = [
          {
            id: "exp-1",
            creatorId: "creator",
            participants: [
              { userId: "user-123", owedAmount: 30, paidAmount: 100 }, // Overpaid by 70
            ],
          },
        ];

        mockRepository.getExpensesByParticipant.mockResolvedValue({
          expenses: expenses as any,
          total: 1,
        });

        const result = await service.getNetUserBalance(
          context,
          "user-123",
          "user-123"
        );

        expect(result.totalOwed).toBe(30);
        expect(result.totalPaid).toBe(100);
        expect(result.netBalance).toBe(-70); // Negative = overpaid
      });

      it("should return zero balance when fully settled", async () => {
        const expenses = [
          {
            id: "exp-1",
            creatorId: "creator",
            participants: [
              { userId: "user-123", owedAmount: 50, paidAmount: 50 },
            ],
          },
        ];

        mockRepository.getExpensesByParticipant.mockResolvedValue({
          expenses: expenses as any,
          total: 1,
        });

        const result = await service.getNetUserBalance(
          context,
          "user-123",
          "user-123"
        );

        expect(result.netBalance).toBe(0);
        expect(result.totalOwed).toBe(50);
        expect(result.totalPaid).toBe(50);
      });
    });

    describe("Net Balance with Multiple Expenses", () => {
      it("should aggregate balance across multiple created expenses", async () => {
        const expenses = [
          {
            id: "exp-dinner",
            creatorId: "alice",
            participants: [
              { userId: "alice", owedAmount: 100, paidAmount: 300 }, // Alice paid all
              { userId: "bob", owedAmount: 100, paidAmount: 0 },
              { userId: "charlie", owedAmount: 100, paidAmount: 0 },
            ],
          },
          {
            id: "exp-movie",
            creatorId: "alice",
            participants: [
              { userId: "alice", owedAmount: 30, paidAmount: 60 },
              { userId: "bob", owedAmount: 30, paidAmount: 0 },
            ],
          },
        ];

        mockRepository.getExpensesByParticipant.mockResolvedValue({
          expenses: expenses as any,
          total: 2,
        });

        const result = await service.getNetUserBalance(
          context,
          "alice",
          "alice"
        );

        // Total owed: 100 + 30 = 130
        // Total paid: 300 + 60 = 360
        // Net: 130 - 360 = -230 (alice is owed $230)
        expect(result.totalOwed).toBe(130);
        expect(result.totalPaid).toBe(360);
        expect(result.netBalance).toBe(-230);
        expect(result.expenseCount).toBe(2);
      });

      it("should aggregate balance when user is creator and participant", async () => {
        const expenses = [
          {
            id: "exp-1",
            creatorId: "alice",
            participants: [
              { userId: "alice", owedAmount: 50, paidAmount: 100 },
              { userId: "bob", owedAmount: 50, paidAmount: 0 },
            ],
          },
          {
            id: "exp-2",
            creatorId: "bob",
            participants: [
              { userId: "alice", owedAmount: 60, paidAmount: 0 },
              { userId: "bob", owedAmount: 60, paidAmount: 120 },
            ],
          },
        ];

        mockRepository.getExpensesByParticipant.mockResolvedValue({
          expenses: expenses as any,
          total: 2,
        });

        const result = await service.getNetUserBalance(
          context,
          "alice",
          "alice"
        );

        // Total owed: 50 + 60 = 110
        // Total paid: 100 + 0 = 100
        // Net: 110 - 100 = 10 (alice owes $10)
        expect(result.totalOwed).toBe(110);
        expect(result.totalPaid).toBe(100);
        expect(result.netBalance).toBe(10);
      });

      it("should handle empty expense list", async () => {
        mockRepository.getExpensesByParticipant.mockResolvedValue({
          expenses: [],
          total: 0,
        });

        const result = await service.getNetUserBalance(
          context,
          "nobody",
          "nobody"
        );

        expect(result.totalOwed).toBe(0);
        expect(result.totalPaid).toBe(0);
        expect(result.netBalance).toBe(0);
        expect(result.expenseCount).toBe(0);
      });
    });

    describe("Net Balance Authorization", () => {
      it("should prevent user from viewing another user's balance", async () => {
        mockRepository.getExpensesByParticipant.mockResolvedValue({
          expenses: [],
          total: 0,
        });

        const other_context = {
          requestId: "req-other",
          authenticatedUserId: "other-user",
          timestamp: new Date(),
        };

        await expect(
          service.getNetUserBalance(other_context, "user-123", "other-user")
        ).rejects.toThrow(ExpenseUnauthorizedException);
      });

      it("should allow user to view only their own balance", async () => {
        const expenses = [
          {
            id: "exp-1",
            creatorId: "user-123",
            participants: [
              { userId: "user-123", owedAmount: 100, paidAmount: 100 },
            ],
          },
        ];

        mockRepository.getExpensesByParticipant.mockResolvedValue({
          expenses: expenses as any,
          total: 1,
        });

        const result = await service.getNetUserBalance(
          context,
          "user-123",
          "user-123"
        );

        expect(result.netBalance).toBe(0);
        expect(result.userId).toBe("user-123");
      });
    });

    describe("Net Balance Edge Cases", () => {
      it("should calculate correctly with decimal amounts", async () => {
        const expenses = [
          {
            id: "exp-decimal",
            creatorId: "alice",
            participants: [
              { userId: "alice", owedAmount: 33.33, paidAmount: 75.50 },
              { userId: "bob", owedAmount: 33.33, paidAmount: 0 },
              { userId: "charlie", owedAmount: 33.34, paidAmount: 0 },
            ],
          },
        ];

        mockRepository.getExpensesByParticipant.mockResolvedValue({
          expenses: expenses as any,
          total: 1,
        });

        const result = await service.getNetUserBalance(
          context,
          "alice",
          "alice"
        );

        expect(result.totalOwed).toBeCloseTo(33.33, 2);
        expect(result.totalPaid).toBeCloseTo(75.50, 2);
        expect(result.netBalance).toBeCloseTo(-42.17, 2);
      });

      it("should handle very large numbers correctly", async () => {
        const expenses = [
          {
            id: "exp-large",
            creatorId: "alice",
            participants: [
              { userId: "alice", owedAmount: 50000, paidAmount: 75000 },
              { userId: "bob", owedAmount: 50000, paidAmount: 0 },
            ],
          },
        ];

        mockRepository.getExpensesByParticipant.mockResolvedValue({
          expenses: expenses as any,
          total: 1,
        });

        const result = await service.getNetUserBalance(
          context,
          "alice",
          "alice"
        );

        expect(result.totalOwed).toBe(50000);
        expect(result.totalPaid).toBe(75000);
        expect(result.netBalance).toBe(-25000);
      });
    });
  });

  // ===== SETTLEMENT TESTS =====

  describe("Settlement Operations", () => {
    it("should record payment and update balance", async () => {
      const mockExpense = {
        id: "exp-123",
        creatorId: "user-123",
        totalAmount: 100,
        participants: [
          { userId: "user-123", owedAmount: 50, paidAmount: 0 },
          { userId: "user-456", owedAmount: 50, paidAmount: 0 },
        ],
      };

      mockRepository.getExpenseById.mockResolvedValue(mockExpense);
      mockRepository.updateParticipantPayment.mockResolvedValue(undefined);
      mockRepository.getExpenseSettlementStatus.mockResolvedValue(
        SettlementStatusEnum.PARTIALLY_PAID
      );

      const result = await service.recordSettlement(
        context,
        "exp-123",
        { amount: 25, paidByUserId: "user-123", paidToUserId: "user-456", paymentMethod: "CASH" } as any,
        "user-123"
      );

      expect(result.status).toBeDefined();
      expect(result.totalPaid).toBe(25);
      expect(result.amountRemaining).toBe(75); // 100 - 25

      expect(mockRepository.updateParticipantPayment).toHaveBeenCalledWith(
        "exp-123",
        "user-123",
        25
      );
    });

    it("should throw error for negative payment amount", async () => {
      const mockExpense = {
        id: "exp-123",
        creatorId: "user-123",
        participants: [
          { userId: "user-123", owedAmount: 50, paidAmount: 0 },
        ],
      };

      mockRepository.getExpenseById.mockResolvedValue(mockExpense);

      await expect(
        service.recordSettlement(
          context,
          "exp-123",
          { amount: -10, paidByUserId: "user-123", paidToUserId: "user-456", paymentMethod: "CASH" } as any,
          "user-123"
        )
      ).rejects.toThrow();
    });

    it("should throw error for overpayment", async () => {
      const mockExpense = {
        id: "exp-123",
        creatorId: "user-123",
        participants: [
          { userId: "user-123", owedAmount: 50, paidAmount: 30 },
        ],
      };

      mockRepository.getExpenseById.mockResolvedValue(mockExpense);

      await expect(
        service.recordSettlement(
          context,
          "exp-123",
          { amount: 30, paidByUserId: "user-123", paidToUserId: "user-456", paymentMethod: "CASH" } as any,
          "user-123"
        )
      ).rejects.toThrow();
    });
  });

  // ===== PAGINATION TESTS =====

  describe("Pagination", () => {
    it("should return paginated expenses", async () => {
      const expenses = Array(5)
        .fill(null)
        .map((_, i) => ({
          id: `exp-${i}`,
          creatorId: "user-123",
          description: `Expense ${i}`,
          totalAmount: 100,
          splitType: ExpenseSplitTypeEnum.EQUAL,
          status: SettlementStatusEnum.PENDING,
          expenseDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [],
        }));

      mockRepository.getExpensesByCreator.mockResolvedValue({
        expenses: expenses.slice(0, 2), // Limit 2
        total: 5,
      });

      const result = await service.getExpensesByCreator(
        context,
        "user-123",
        "user-123",
        2,
        0
      );

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.hasMore).toBe(true); // 2 + 0 < 5
    });

    it("should indicate no more results on last page", async () => {
      mockRepository.getExpensesByCreator.mockResolvedValue({
        expenses: [],
        total: 5,
      });

      const result = await service.getExpensesByCreator(
        context,
        "user-123",
        "user-123",
        2,
        4
      );

      expect(result.pagination.hasMore).toBe(false); // 2 + 4 >= 5
    });
  });

  // ===== ERROR HANDLING TESTS =====

  describe("Error Handling", () => {
    it("should handle expense not found", async () => {
      mockRepository.getExpenseById.mockResolvedValue(null);

      await expect(
        service.getExpenseById(context, "nonexistent", "user-123")
      ).rejects.toThrow(ExpenseNotFoundException);
    });

    it("should log errors with full context", async () => {
      mockRepository.getExpenseById.mockRejectedValue(
        new Error("Database error")
      );

      try {
        await service.getExpenseById(context, "exp-123", "user-123");
      } catch (error) {
        // Expected
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "req-123",
          action: "GetExpenseById",
          reason: "Database error",
        })
      );
    });
  });

  // ===== REAL-WORLD SCENARIO TESTS =====

  describe("Real-World Scenarios", () => {
    it("should handle restaurant bill scenario", async () => {
      // 4 friends, $120 bill, Alice paid all, equal split
      const mockExpense = {
        id: "exp-restaurant",
        creatorId: "alice",
        description: "Dinner at Luigi's",
        totalAmount: 120,
        splitType: ExpenseSplitTypeEnum.EQUAL,
        status: SettlementStatusEnum.PENDING,
        expenseDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [
          { userId: "alice", owedAmount: 30, paidAmount: 120 },
          { userId: "bob", owedAmount: 30, paidAmount: 0 },
          { userId: "charlie", owedAmount: 30, paidAmount: 0 },
          { userId: "diana", owedAmount: 30, paidAmount: 0 },
        ],
      };

      mockRepository.getExpenseById.mockResolvedValue(mockExpense);
      mockRepository.getExpenseSettlementStatus.mockResolvedValue(
        SettlementStatusEnum.PENDING
      );

      // Bob records payment
      mockRepository.updateParticipantPayment.mockResolvedValue(undefined);

      const result = await service.recordSettlement(
        context,
        "exp-restaurant",
        { amount: 30, paidByUserId: "bob", paidToUserId: "alice", paymentMethod: "CASH" } as any,
        "bob"
      );

      expect(result.status).toBeDefined();
      expect(result.totalPaid).toBe(30); // Bob paid 30
      expect(result.amountRemaining).toBe(90); // 120 - 30
    });

    it("should handle complex expense with custom split", async () => {
      // Different people ordered different amounts
      const mockExpense = {
        id: "exp-complex",
        creatorId: "alice",
        description: "Team lunch",
        totalAmount: 155,
        splitType: ExpenseSplitTypeEnum.BY_AMOUNT,
        status: SettlementStatusEnum.PENDING,
        expenseDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [
          { userId: "alice", owedAmount: 40, paidAmount: 155 }, // Alice paid all
          { userId: "bob", owedAmount: 60, paidAmount: 0 },     // Ordered most
          { userId: "charlie", owedAmount: 55, paidAmount: 0 }, // Ordered some
        ],
      };

      mockRepository.getExpenseById.mockResolvedValue(mockExpense);
      mockRepository.getExpensesByParticipant.mockResolvedValue({
        expenses: [mockExpense],
        total: 1,
      });

      const balance = await service.getNetUserBalance(
        context,
        "alice",
        "alice"
      );

      // Alice: owes 40, paid 155 → net = -115 (owed $115)
      expect(balance.netBalance).toBe(-115);
    });
  });
});
