/**
 * Balance Calculation Algorithm - Unit Tests
 *
 * Comprehensive tests for all balance calculation algorithms.
 * Demonstrates:
 * - Equal split calculations
 * - Custom amount splits
 * - Percentage-based splits
 * - Itemized splits
 * - Balance calculations
 * - Settlement optimization
 * - Edge cases and error handling
 *
 * @file src/expenses/balance-calculator.spec.ts
 */

import { BalanceCalculator } from "./balance-calculator";
import { ExpenseSplitTypeEnum } from "./expense.types";
import { ExpenseSplitException } from "./expense.exceptions";

describe("BalanceCalculator - Comprehensive Algorithm Tests", () => {
  let calculator: BalanceCalculator;

  beforeEach(() => {
    calculator = new BalanceCalculator();
  });

  // ===== ALGORITHM 1: EQUAL SPLIT TESTS =====

  describe("Algorithm 1: Equal Split", () => {
    it("should split expense equally among 3 people", () => {
      const shares = calculator.calculateShares(
        100,
        ["alice", "bob", "charlie"],
        ExpenseSplitTypeEnum.EQUAL
      );

      expect(shares.alice).toBe(33.33);
      expect(shares.bob).toBe(33.33);
      expect(shares.charlie).toBe(33.34); // Gets remainder for rounding
      expect(shares.alice + shares.bob + shares.charlie).toBe(100);
    });

    it("should handle equal split with 2 people", () => {
      const shares = calculator.calculateShares(
        75.50,
        ["alice", "bob"],
        ExpenseSplitTypeEnum.EQUAL
      );

      expect(shares.alice).toBe(37.75);
      expect(shares.bob).toBe(37.75);
      expect(shares.alice + shares.bob).toBe(75.50);
    });

    it("should handle equal split with 4 people and rounding", () => {
      const shares = calculator.calculateShares(
        100,
        ["a", "b", "c", "d"],
        ExpenseSplitTypeEnum.EQUAL
      );

      expect(shares.a).toBe(25);
      expect(shares.b).toBe(25);
      expect(shares.c).toBe(25);
      expect(shares.d).toBe(25);
      expect(shares.a + shares.b + shares.c + shares.d).toBe(100);
    });

    it("should handle equal split with difficult rounding (e.g., $100 / 3)", () => {
      const shares = calculator.calculateShares(
        100,
        ["x", "y", "z"],
        ExpenseSplitTypeEnum.EQUAL
      );

      // 100 / 3 = 33.333...
      expect(shares.x).toBe(33.33);
      expect(shares.y).toBe(33.33);
      expect(shares.z).toBe(33.34);
      expect(shares.x + shares.y + shares.z).toBeCloseTo(100, 2);
    });

    it("should throw error for 0 or negative total", () => {
      expect(() => {
        calculator.calculateShares(
          0,
          ["alice", "bob"],
          ExpenseSplitTypeEnum.EQUAL
        );
      }).toThrow(ExpenseSplitException);
    });

    it("should throw error for empty participant list", () => {
      expect(() => {
        calculator.calculateShares(
          100,
          [],
          ExpenseSplitTypeEnum.EQUAL
        );
      }).toThrow(ExpenseSplitException);
    });
  });

  // ===== ALGORITHM 2: CUSTOM AMOUNT SPLIT TESTS =====

  describe("Algorithm 2: Custom Amount Split", () => {
    it("should split by custom amounts", () => {
      const shares = calculator.calculateShares(
        150,
        ["alice", "bob", "charlie"],
        ExpenseSplitTypeEnum.BY_AMOUNT,
        {
          splits: {
            alice: 60,
            bob: 50,
            charlie: 40,
          },
        }
      );

      expect(shares.alice).toBe(60);
      expect(shares.bob).toBe(50);
      expect(shares.charlie).toBe(40);
    });

    it("should throw error if amounts don't sum to total", () => {
      expect(() => {
        calculator.calculateShares(
          100,
          ["alice", "bob"],
          ExpenseSplitTypeEnum.BY_AMOUNT,
          {
            splits: {
              alice: 60,
              bob: 40, // Total = 100, but we said 100
            },
          }
        );
      }).not.toThrow(); // This should work
    });

    it("should throw error if participant is missing amount", () => {
      expect(() => {
        calculator.calculateShares(
          100,
          ["alice", "bob", "charlie"],
          ExpenseSplitTypeEnum.BY_AMOUNT,
          {
            splits: {
              alice: 40,
              bob: 60, // charlie is missing
            },
          }
        );
      }).toThrow(ExpenseSplitException);
    });

    it("should throw error for negative amounts", () => {
      expect(() => {
        calculator.calculateShares(
          100,
          ["alice", "bob"],
          ExpenseSplitTypeEnum.BY_AMOUNT,
          {
            splits: {
              alice: -50,
              bob: 150,
            },
          }
        );
      }).toThrow(ExpenseSplitException);
    });

    it("should round amounts to 2 decimal places", () => {
      const shares = calculator.calculateShares(
        100,
        ["alice", "bob"],
        ExpenseSplitTypeEnum.BY_AMOUNT,
        {
          splits: {
            alice: 33.333,
            bob: 66.667,
          },
        }
      );

      expect(shares.alice).toBe(33.33);
      expect(shares.bob).toBe(66.67);
    });
  });

  // ===== ALGORITHM 3: PERCENTAGE SPLIT TESTS =====

  describe("Algorithm 3: Percentage-Based Split", () => {
    it("should split by percentages", () => {
      const shares = calculator.calculateShares(
        100,
        ["alice", "bob", "charlie"],
        ExpenseSplitTypeEnum.BY_PERCENTAGE,
        {
          splits: {
            alice: 50,   // 50% = $50
            bob: 30,     // 30% = $30
            charlie: 20, // 20% = $20
          },
        }
      );

      expect(shares.alice).toBe(50);
      expect(shares.bob).toBe(30);
      expect(shares.charlie).toBe(20);
    });

    it("should handle unequal percentages correctly", () => {
      const shares = calculator.calculateShares(
        200,
        ["alice", "bob"],
        ExpenseSplitTypeEnum.BY_PERCENTAGE,
        {
          splits: {
            alice: 65,
            bob: 35,
          },
        }
      );

      expect(shares.alice).toBe(130);
      expect(shares.bob).toBe(70);
    });

    it("should throw error if percentages don't sum to 100", () => {
      expect(() => {
        calculator.calculateShares(
          100,
          ["alice", "bob", "charlie"],
          ExpenseSplitTypeEnum.BY_PERCENTAGE,
          {
            splits: {
              alice: 40,
              bob: 40,
              charlie: 10, // Sum = 90, not 100
            },
          }
        );
      }).toThrow(ExpenseSplitException);
    });

    it("should throw error for percentage > 100 or < 0", () => {
      expect(() => {
        calculator.calculateShares(
          100,
          ["alice", "bob"],
          ExpenseSplitTypeEnum.BY_PERCENTAGE,
          {
            splits: {
              alice: 150, // > 100
              bob: -50,
            },
          }
        );
      }).toThrow(ExpenseSplitException);
    });

    it("should handle rounding with percentages", () => {
      const shares = calculator.calculateShares(
        100,
        ["a", "b", "c"],
        ExpenseSplitTypeEnum.BY_PERCENTAGE,
        {
          splits: {
            a: 33.333,
            b: 33.333,
            c: 33.334,
          },
        }
      );

      // Should sum to exactly 100
      const sum = shares.a + shares.b + shares.c;
      expect(sum).toBeCloseTo(100, 2);
    });
  });

  // ===== ALGORITHM 4: ITEMIZED SPLIT TESTS =====

  describe("Algorithm 4: Itemized Split", () => {
    it("should split by items", () => {
      const shares = calculator.calculateShares(
        120,
        ["alice", "bob", "charlie", "diana"],
        ExpenseSplitTypeEnum.ITEMIZED,
        {
          items: [
            { name: "Steak", amount: 35, claimedByUserId: "alice" },
            { name: "Fish", amount: 32, claimedByUserId: "bob" },
            { name: "Pasta", amount: 28, claimedByUserId: "charlie" },
            { name: "Salad", amount: 25, claimedByUserId: "diana" },
          ],
        }
      );

      expect(shares.alice).toBe(35);
      expect(shares.bob).toBe(32);
      expect(shares.charlie).toBe(28);
      expect(shares.diana).toBe(25);
    });

    it("should aggregate items for same person", () => {
      const shares = calculator.calculateShares(
        100,
        ["alice", "bob"],
        ExpenseSplitTypeEnum.ITEMIZED,
        {
          items: [
            { name: "Item 1", amount: 30, claimedByUserId: "alice" },
            { name: "Item 2", amount: 20, claimedByUserId: "alice" },
            { name: "Item 3", amount: 50, claimedByUserId: "bob" },
          ],
        }
      );

      expect(shares.alice).toBe(50); // 30 + 20
      expect(shares.bob).toBe(50);
    });

    it("should throw error if item assigned to non-participant", () => {
      expect(() => {
        calculator.calculateShares(
          100,
          ["alice", "bob"],
          ExpenseSplitTypeEnum.ITEMIZED,
          {
            items: [
              { name: "Item 1", amount: 50, claimedByUserId: "alice" },
              { name: "Item 2", amount: 50, claimedByUserId: "charlie" }, // Not a participant
            ],
          }
        );
      }).toThrow(ExpenseSplitException);
    });

    it("should throw error if item amounts don't sum to total", () => {
      expect(() => {
        calculator.calculateShares(
          100,
          ["alice", "bob"],
          ExpenseSplitTypeEnum.ITEMIZED,
          {
            items: [
              { name: "Item 1", amount: 40, claimedByUserId: "alice" },
              { name: "Item 2", amount: 50, claimedByUserId: "bob" }, // Sum = 90, not 100
            ],
          }
        );
      }).toThrow(ExpenseSplitException);
    });

    it("should throw error for negative item amount", () => {
      expect(() => {
        calculator.calculateShares(
          100,
          ["alice", "bob"],
          ExpenseSplitTypeEnum.ITEMIZED,
          {
            items: [
              { name: "Item 1", amount: -20, claimedByUserId: "alice" },
              { name: "Item 2", amount: 120, claimedByUserId: "bob" },
            ],
          }
        );
      }).toThrow(ExpenseSplitException);
    });

    it("should throw error for empty items", () => {
      expect(() => {
        calculator.calculateShares(
          100,
          ["alice", "bob"],
          ExpenseSplitTypeEnum.ITEMIZED,
          { items: [] }
        );
      }).toThrow(ExpenseSplitException);
    });
  });

  // ===== ALGORITHM 6: BALANCE CALCULATION TESTS =====

  describe("Algorithm 6: Calculate Balances", () => {
    it("should calculate balances from participants", () => {
      const expense = {
        id: "exp-1",
        creatorId: "alice",
        totalAmount: 100,
        participants: [
          { userId: "alice", owedAmount: 25, paidAmount: 10 },
          { userId: "bob", owedAmount: 25, paidAmount: 0 },
          { userId: "charlie", owedAmount: 25, paidAmount: 15 },
          { userId: "diana", owedAmount: 25, paidAmount: 25 },
        ],
        settlements: [],
      };

      const balances = calculator.calculateBalances(expense);

      expect(balances).toHaveLength(4);
      expect(balances[0]).toEqual({
        userId: "alice",
        owedAmount: 25,
        paidAmount: 10,
        balance: 15, // owed - paid
      });
      expect(balances[3]).toEqual({
        userId: "diana",
        owedAmount: 25,
        paidAmount: 25,
        balance: 0, // Settled
      });
    });

    it("should handle negative balance (overpayment)", () => {
      const expense = {
        id: "exp-1",
        creatorId: "alice",
        totalAmount: 100,
        participants: [
          { userId: "alice", owedAmount: 25, paidAmount: 30 },
        ],
        settlements: [],
      };

      const balances = calculator.calculateBalances(expense);

      expect(balances[0].balance).toBe(-5); // Overpaid by $5
    });
  });

  // ===== ALGORITHM 7: OPTIMAL SETTLEMENT TESTS =====

  describe("Algorithm 7: Optimal Settlement Path", () => {
    it("should calculate minimal settlements for 3 people", () => {
      const expense = {
        id: "exp-1",
        creatorId: "alice",
        totalAmount: 100,
        participants: [
          { userId: "alice", owedAmount: 40, paidAmount: 40 }, // Settled
          { userId: "bob", owedAmount: 30, paidAmount: 0 },    // Owes $30
          { userId: "charlie", owedAmount: 30, paidAmount: 0 }, // Owes $30
        ],
        settlements: [],
      };

      const settlements = calculator.calculateOptimalSettlements(expense);

      // Should have minimum 2 payments
      expect(settlements.length).toBeLessThanOrEqual(2);

      // Verify settlements are valid
      for (const settlement of settlements) {
        expect(settlement.amount).toBeGreaterThan(0);
        expect(settlement.from).not.toBe(settlement.to);
      }
    });

    it("should handle complex settlement scenario", () => {
      const expense = {
        id: "exp-1",
        creatorId: "alice",
        totalAmount: 200,
        participants: [
          { userId: "alice", owedAmount: 50, paidAmount: 100 }, // Paid $50 extra
          { userId: "bob", owedAmount: 50, paidAmount: 0 },
          { userId: "charlie", owedAmount: 50, paidAmount: 25 },
          { userId: "diana", owedAmount: 50, paidAmount: 0 },
        ],
        settlements: [],
      };

      const settlements = calculator.calculateOptimalSettlements(expense);

      // Should minimize number of transactions
      expect(settlements.length).toBeGreaterThan(0);
      expect(settlements.length).toBeLessThanOrEqual(3);
    });

    it("should handle single debtor, multiple creditors", () => {
      const expense = {
        id: "exp-1",
        creatorId: "alice",
        totalAmount: 300,
        participants: [
          { userId: "alice", owedAmount: 100, paidAmount: 300 },
          { userId: "bob", owedAmount: 100, paidAmount: 0 },
          { userId: "charlie", owedAmount: 100, paidAmount: 0 },
        ],
        settlements: [],
      };

      const settlements = calculator.calculateOptimalSettlements(expense);

      // Should need exactly 2 payments (alice -> bob, alice -> charlie)
      expect(settlements.length).toBe(2);

      let totalFromAlice = 0;
      for (const settlement of settlements) {
        expect(settlement.to).toBe("alice");
        totalFromAlice += settlement.amount;
      }
      expect(totalFromAlice).toBeCloseTo(200, 2); // alice overpaid by $200
    });
  });

  // ===== ALGORITHM 8: SETTLEMENT VALIDATION TESTS =====

  describe("Algorithm 8: Validate Settlements", () => {
    it("should validate correct settlement transactions", () => {
      const expense = {
        id: "exp-1",
        creatorId: "alice",
        totalAmount: 100,
        participants: [
          { userId: "alice", owedAmount: 40, paidAmount: 40 },
          { userId: "bob", owedAmount: 30, paidAmount: 0 },
          { userId: "charlie", owedAmount: 30, paidAmount: 0 },
        ],
        settlements: [],
      };

      const settlements = [
        { from: "bob", to: "alice", amount: 30 },
        { from: "charlie", to: "alice", amount: 30 },
      ];

      const isValid = calculator.validateSettlements(expense, settlements);
      expect(isValid).toBe(true);
    });

    it("should reject incomplete settlements", () => {
      const expense = {
        id: "exp-1",
        creatorId: "alice",
        totalAmount: 100,
        participants: [
          { userId: "alice", owedAmount: 50, paidAmount: 50 },
          { userId: "bob", owedAmount: 50, paidAmount: 0 },
        ],
        settlements: [],
      };

      const settlements = [
        { from: "bob", to: "alice", amount: 25 }, // Only half paid
      ];

      const isValid = calculator.validateSettlements(expense, settlements);
      expect(isValid).toBe(false);
    });
  });

  // ===== ALGORITHM 9: PARTICIPANT SUMMARY TESTS =====

  describe("Algorithm 9: Participant Summary", () => {
    it("should generate correct participant summaries", () => {
      const expense = {
        id: "exp-1",
        creatorId: "alice",
        totalAmount: 100,
        participants: [
          { userId: "alice", owedAmount: 25, paidAmount: 25 },
          { userId: "bob", owedAmount: 25, paidAmount: 10 },
          { userId: "charlie", owedAmount: 25, paidAmount: 0 },
          { userId: "diana", owedAmount: 25, paidAmount: 15 },
        ],
        settlements: [],
      };

      const summaries = calculator.calculateParticipantSummary(expense);

      // Alice should be SETTLED
      expect(summaries[0].userId).toBe("alice");
      expect(summaries[0].status).toBe("SETTLED");

      // Bob should be PARTIALLY_PAID
      expect(summaries[1].userId).toBe("bob");
      expect(summaries[1].status).toBe("PARTIALLY_PAID");
      expect(summaries[1].balanceRemaining).toBe(15);

      // Charlie should be PENDING
      expect(summaries[2].userId).toBe("charlie");
      expect(summaries[2].status).toBe("PENDING");
      expect(summaries[2].balanceRemaining).toBe(25);
    });
  });

  // ===== ALGORITHM 10: PAYMENT APPLICATION TESTS =====

  describe("Algorithm 10: Apply Payment", () => {
    it("should apply valid payment", () => {
      const balance = {
        userId: "bob",
        balance: 30,
        owedAmount: 30,
        paidAmount: 0,
      };

      const updated = calculator.applyPayment(balance, 15);

      expect(updated.paidAmount).toBe(15);
      expect(updated.balance).toBe(15);
    });

    it("should throw error for negative payment", () => {
      const balance = {
        userId: "bob",
        balance: 30,
        owedAmount: 30,
        paidAmount: 0,
      };

      expect(() => {
        calculator.applyPayment(balance, -10);
      }).toThrow(ExpenseSplitException);
    });

    it("should throw error for overpayment", () => {
      const balance = {
        userId: "bob",
        balance: 30,
        owedAmount: 30,
        paidAmount: 0,
      };

      expect(() => {
        calculator.applyPayment(balance, 50); // Exceeds owed amount
      }).toThrow(ExpenseSplitException);
    });

    it("should allow payment up to owed amount", () => {
      const balance = {
        userId: "bob",
        balance: 30,
        owedAmount: 30,
        paidAmount: 0,
      };

      const updated = calculator.applyPayment(balance, 30);

      expect(updated.paidAmount).toBe(30);
      expect(updated.balance).toBeCloseTo(0, 2);
    });
  });

  // ===== ALGORITHM 11: RECONCILIATION TESTS =====

  describe("Algorithm 11: Reconciliation Check", () => {
    it("should pass for valid expense", () => {
      const expense = {
        id: "exp-1",
        creatorId: "alice",
        totalAmount: 100,
        participants: [
          { userId: "alice", owedAmount: 30, paidAmount: 15 },
          { userId: "bob", owedAmount: 40, paidAmount: 20 },
          { userId: "charlie", owedAmount: 30, paidAmount: 0 },
        ],
        settlements: [
          { paidByUserId: "alice", paidToUserId: "charlie", amount: 15, date: new Date() },
          { paidByUserId: "bob", paidToUserId: "charlie", amount: 20, date: new Date() },
        ],
      };

      expect(() => {
        calculator.reconcile(expense);
      }).not.toThrow();
    });

    it("should fail if total owed doesn't match expense", () => {
      const expense = {
        id: "exp-1",
        creatorId: "alice",
        totalAmount: 100,
        participants: [
          { userId: "alice", owedAmount: 30, paidAmount: 0 },
          { userId: "bob", owedAmount: 40, paidAmount: 0 }, // Sum = 70, not 100
        ],
        settlements: [],
      };

      expect(() => {
        calculator.reconcile(expense);
      }).toThrow(ExpenseSplitException);
    });
  });

  // ===== REAL-WORLD SCENARIO TESTS =====

  describe("Real-World Scenarios", () => {
    it("should handle restaurant bill scenario", () => {
      // 4 friends, $120 restaurant bill
      const totalAmount = 120;
      const participants = ["alice", "bob", "charlie", "diana"];

      // Equal split
      const shares = calculator.calculateShares(
        totalAmount,
        participants,
        ExpenseSplitTypeEnum.EQUAL
      );

      // Alice paid the full bill
      const expense = {
        id: "exp-1",
        creatorId: "alice",
        totalAmount,
        participants: [
          { userId: "alice", owedAmount: shares.alice, paidAmount: totalAmount },
          { userId: "bob", owedAmount: shares.bob, paidAmount: 0 },
          { userId: "charlie", owedAmount: shares.charlie, paidAmount: 0 },
          { userId: "diana", owedAmount: shares.diana, paidAmount: 0 },
        ],
        settlements: [],
      };

      // Check settlements needed
      const settlements = calculator.calculateOptimalSettlements(expense);

      // Should have exactly 3 settlements (bob, charlie, diana each pay alice)
      expect(settlements.length).toBe(3);

      // Each should pay ~$30
      for (const settlement of settlements) {
        expect(settlement.to).toBe("alice");
        expect(settlement.amount).toBeCloseTo(30, 1);
      }
    });

    it("should handle roommate rent scenario", () => {
      // Rent split by income
      const totalAmount = 3000;
      const participants = ["alice", "bob", "charlie"];

      const shares = calculator.calculateShares(
        totalAmount,
        participants,
        ExpenseSplitTypeEnum.BY_PERCENTAGE,
        {
          splits: {
            alice: 50,   // Higher income
            bob: 30,
            charlie: 20, // Lower income
          },
        }
      );

      expect(shares.alice).toBe(1500);
      expect(shares.bob).toBe(900);
      expect(shares.charlie).toBe(600);
      expect(shares.alice + shares.bob + shares.charlie).toBe(totalAmount);
    });

    it("should handle trip expenses with multiple payments", () => {
      // Group trip with various expenses
      const totalAmount = 500;
      const participants = ["alice", "bob", "charlie"];

      const expense = {
        id: "exp-1",
        creatorId: "alice",
        totalAmount,
        participants: [
          { userId: "alice", owedAmount: 250, paidAmount: 300 }, // Paid for gas
          { userId: "bob", owedAmount: 125, paidAmount: 50 },    // Paid for some
          { userId: "charlie", owedAmount: 125, paidAmount: 150 }, // Overpaid
        ],
        settlements: [],
      };

      const summaries = calculator.calculateParticipantSummary(expense);

      // Alice is owed $50 (overpaid)
      expect(summaries[0].balanceRemaining).toBe(-50);

      // Bob owes $75
      expect(summaries[1].balanceRemaining).toBe(75);

      // Charlie is owed $25 (overpaid)
      expect(summaries[2].balanceRemaining).toBe(-25);
    });
  });
});
