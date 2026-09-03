/**
 * Shared Expense Module - Complete Documentation
 *
 * This document describes the Shared Expense model for managing group expenses
 * in the FinTech API.
 *
 * @file SHARED_EXPENSE_DOCUMENTATION.md
 */

# Shared Expense Module - Complete Implementation

## 📋 Overview

The Shared Expense module enables users to create group expenses and track how amounts are split and settled among participants. This is essential for:

- Roommate expense splitting
- Group travel costs
- Restaurant bills
- Shared household purchases
- Team expenses

---

## 🏗️ Database Schema

### **3-Model Architecture**

```
SharedExpense (Main)
    ├─ creator (User)
    ├─ participants (SharedExpenseParticipant[])
    └─ settlements (ExpenseSettlement[])

SharedExpenseParticipant (Junction Table)
    ├─ expenseId (FK)
    ├─ userId (FK)
    ├─ owedAmount (Decimal)
    └─ paidAmount (Decimal)

ExpenseSettlement (Audit Trail)
    ├─ expenseId (FK)
    ├─ paidByUserId (FK)
    ├─ paidToUserId (FK)
    └─ amount (Decimal)
```

---

## 📊 Model Details

### **1. SharedExpense Model**

**Purpose:** Main expense record

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Unique identifier |
| `creatorId` | UUID | User who created expense |
| `description` | String (500 chars) | Expense description |
| `totalAmount` | Decimal(15,2) | Total expense amount |
| `splitType` | Enum | How to split (EQUAL, BY_AMOUNT, BY_PERCENTAGE, ITEMIZED) |
| `status` | Enum | Settlement status |
| `category` | String (optional) | FOOD, RENT, UTILITIES, etc. |
| `notes` | String (optional) | Additional notes |
| `expenseDate` | DateTime (optional) | When expense occurred |
| `createdAt` | DateTime | Record creation time |
| `updatedAt` | DateTime | Last update time |

**Indexes:**
- `[creatorId]` - For finding creator's expenses
- `[status]` - For filtering by settlement status
- `[createdAt DESC]` - For sorting by date
- `[creatorId, status]` - For combined queries

**Example:**
```json
{
  "id": "clpk1x9z80000qjqq9q9q9q9q",
  "creatorId": "550e8400-e29b-41d4-a716-446655440000",
  "description": "Dinner at Luigi's",
  "totalAmount": 120.50,
  "splitType": "EQUAL",
  "status": "PENDING",
  "category": "FOOD",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

### **2. SharedExpenseParticipant Model**

**Purpose:** Track each person's share and payment progress

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Unique identifier |
| `expenseId` | String (FK) | Reference to expense |
| `userId` | UUID | Participant user ID |
| `owedAmount` | Decimal(15,2) | Amount they owe |
| `paidAmount` | Decimal(15,2) | Amount they've paid |
| `notes` | String (optional) | Participant-specific notes |
| `createdAt` | DateTime | Added to expense on date |
| `updatedAt` | DateTime | Last update time |

**Constraints:**
- Unique constraint on `[expenseId, userId]` - prevent duplicate participants

**Indexes:**
- `[expenseId]` - For finding expense participants
- `[userId]` - For finding user's expense participations
- `[createdAt]` - For sorting

**Example:**
```json
{
  "id": "clpk1xab50001qjqq9q9q9q9r",
  "expenseId": "clpk1x9z80000qjqq9q9q9q9q",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "owedAmount": 30.13,
  "paidAmount": 0.00,
  "notes": null
}
```

**Balance Tracking:**
```
owedAmount    = 30.13
paidAmount    = 0.00
balanceRemaining = 30.13 - 0.00 = 30.13

Status: PENDING (no payment made)
```

---

### **3. ExpenseSettlement Model**

**Purpose:** Audit trail of all payments

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | String (CUID) | Unique identifier |
| `expenseId` | String (FK) | Reference to expense |
| `paidByUserId` | UUID | Who made the payment |
| `paidToUserId` | UUID | Who received the payment |
| `amount` | Decimal(15,2) | Payment amount |
| `paymentMethod` | String | CASH, VENMO, PAYPAL, BANK_TRANSFER, CARD |
| `transactionReference` | String (optional) | Receipt or transaction ID |
| `settledAt` | DateTime | When payment was made |
| `createdAt` | DateTime | Record creation time |

**Constraints:**
- Unique constraint on `[expenseId, paidByUserId, paidToUserId, settledAt]`

**Indexes:**
- `[expenseId]` - Find settlements for expense
- `[paidByUserId]` - Find payments by user
- `[paidToUserId]` - Find payments received by user
- `[settledAt]` - For sorting by settlement date

**Example:**
```json
{
  "id": "clpk1xdb60002qjqq9q9q9q9s",
  "expenseId": "clpk1x9z80000qjqq9q9q9q9q",
  "paidByUserId": "550e8400-e29b-41d4-a716-446655440001",
  "paidToUserId": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 30.13,
  "paymentMethod": "VENMO",
  "transactionReference": "VENMO_XYZ123",
  "settledAt": "2024-01-15T15:45:00Z"
}
```

---

## 💹 Split Types

### **1. EQUAL Split**
Divides expense equally among all participants

```typescript
// Example: $120 split among 4 people
totalAmount: 120.00
participants: ["alice", "bob", "charlie", "diana"]

// Result:
{
  alice: 30.00,
  bob: 30.00,
  charlie: 30.00,
  diana: 30.00
}
```

### **2. BY_AMOUNT Split**
Each person owes a specific amount

```typescript
// Example: Custom amounts
totalAmount: 120.00
splits: {
  alice: 40.00,
  bob: 30.00,
  charlie: 25.00,
  diana: 25.00
}
```

### **3. BY_PERCENTAGE Split**
Each person pays a percentage

```typescript
// Example: Income-based split
totalAmount: 120.00
splits: {
  alice: 40,    // 40% = $48
  bob: 30,      // 30% = $36
  charlie: 20,  // 20% = $24
  diana: 10     // 10% = $12
}
```

### **4. ITEMIZED Split**
Each person owes for specific items they used

```typescript
// Example: Restaurant items
totalAmount: 120.00
items: [
  { name: "Steak", amount: 35.00, claimedByUserId: "alice" },
  { name: "Fish", amount: 32.00, claimedByUserId: "bob" },
  { name: "Pasta", amount: 28.00, claimedByUserId: "charlie" },
  { name: "Salad", amount: 25.00, claimedByUserId: "diana" }
]
```

---

## 📁 Implementation Files

### **Core Files Created**

1. **SHARED_EXPENSE_SCHEMA.prisma**
   - Database models
   - Enums and relationships
   - Indexes and constraints

2. **src/expenses/expense.types.ts**
   - TypeScript type definitions
   - Enum exports
   - Interface definitions for split configs
   - Balance tracking types

3. **src/expenses/expense.dto.ts**
   - Request/response contracts
   - Input/output data shapes
   - Layer-specific DTOs

4. **src/expenses/expense.exceptions.ts**
   - 7 custom exception types
   - Domain-specific errors
   - HTTP status mapping

5. **src/expenses/split-calculator.ts**
   - Split calculation logic
   - Handles all split types
   - Validation and rounding
   - 200+ lines of utility code

6. **src/expenses/expense.repository.ts**
   - Repository layer
   - Database operations
   - Query methods with pagination
   - Participant payment tracking

---

## 🔐 Security Features

### **Authorization**
```typescript
// Only creator can modify expense
if (authenticatedUserId !== expense.creatorId) {
  throw new ExpenseUnauthorizedException();
}

// Only participants can view details
if (!expense.participants.some(p => p.userId === authenticatedUserId)) {
  throw new ExpenseUnauthorizedException();
}
```

### **Validation**
```typescript
// Amount validation
if (totalAmount <= 0) throw new ExpenseValidationException(...);

// Decimal precision (currency)
if (amount has > 2 decimal places) throw ExpenseValidationException(...);

// Split validation
validateSplitConfig(totalAmount, participantIds, splitConfig);
```

### **Data Integrity**
```typescript
// Enforce split totals match expense total
// Prevent duplicate participants
// Track all payments in settlement records
// Prevent negative amounts
```

---

## 📊 Usage Examples

### **Creating a Shared Expense**

```typescript
const input: CreateSharedExpenseInput = {
  creatorId: "550e8400-e29b-41d4-a716-446655440000",
  description: "Dinner at Luigi's",
  totalAmount: 120.50,
  splitType: ExpenseSplitTypeEnum.EQUAL,
  participantIds: [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001",
    "550e8400-e29b-41d4-a716-446655440002",
    "550e8400-e29b-41d4-a716-446655440003"
  ],
  category: ExpenseCategoryEnum.FOOD,
  expenseDate: new Date("2024-01-15")
};

const expense = await sharedExpenseService.createExpense(context, input);
```

### **Calculating Splits**

```typescript
const calculator = new SplitCalculator();

// Equal split
const equalSplit = calculator.calculateSplit(
  120.50,
  ExpenseSplitTypeEnum.EQUAL,
  ["alice", "bob", "charlie", "diana"]
);
// Result: { alice: 30.13, bob: 30.13, charlie: 30.12, diana: 30.12 }

// By amount
const amountSplit = calculator.calculateSplit(
  120.50,
  ExpenseSplitTypeEnum.BY_AMOUNT,
  ["alice", "bob"],
  { type: "BY_AMOUNT", splits: { alice: 75.00, bob: 45.50 } }
);
```

### **Recording a Settlement**

```typescript
const settlement: RecordSettlementRequest = {
  paidByUserId: "550e8400-e29b-41d4-a716-446655440001",
  paidToUserId: "550e8400-e29b-41d4-a716-446655440000",
  amount: 30.13,
  paymentMethod: PaymentMethodEnum.VENMO,
  transactionReference: "VENMO_ABC123"
};

await sharedExpenseService.recordSettlement(context, expenseId, settlement);
```

---

## 📋 API Endpoints (To Be Implemented)

```
POST   /api/v1/expenses              - Create shared expense
GET    /api/v1/expenses              - List user's expenses
GET    /api/v1/expenses/:id          - Get expense details
PUT    /api/v1/expenses/:id          - Update expense
DELETE /api/v1/expenses/:id          - Delete expense

GET    /api/v1/expenses/:id/summary  - Get settlement summary
POST   /api/v1/expenses/:id/settle   - Record payment
GET    /api/v1/expenses/:id/history  - Settlement history
```

---

## 🧪 Testing Strategy

Tests should cover:

- ✅ All 4 split types
- ✅ Rounding and decimal precision
- ✅ Authorization checks
- ✅ Amount validation
- ✅ Settlement tracking
- ✅ Pagination
- ✅ Error handling
- ✅ Database operations

---

## 🔄 Data Flow

```
User Creates Expense
    ↓
[Controller] validates input
    ↓
[Validator] checks amounts, decimals, splits
    ↓
[SplitCalculator] calculates shares per person
    ↓
[Service] creates expense + participants
    ↓
[Repository] stores in database
    ↓
Participants notified of expense
    ↓
Each participant can record payment
    ↓
[Repository] tracks payments in settlements
    ↓
Settlement status updated automatically
```

---

## 📈 Data Integrity Example

```
Scenario: $100 restaurant bill, 3 people

1. Create Expense
   - totalAmount: 100.00
   - status: PENDING
   - participants created (owed=0 initially)

2. Calculate Split
   - alice: 33.33
   - bob: 33.33
   - charlie: 33.34 (gets remainder for rounding)

3. Update Participants
   - alice: owedAmount=33.33, paidAmount=0.00
   - bob: owedAmount=33.33, paidAmount=0.00
   - charlie: owedAmount=33.34, paidAmount=0.00

4. Record Settlement: bob pays alice $33.33
   - Create ExpenseSettlement record
   - Update participant: bob.paidAmount = 33.33

5. Record Settlement: charlie pays alice $33.34
   - Create ExpenseSettlement record
   - Update participant: charlie.paidAmount = 33.34

6. Check Status
   - alice: owedAmount=33.33, paidAmount=33.33 ✓ SETTLED
   - bob: owedAmount=33.33, paidAmount=33.33 ✓ SETTLED
   - charlie: owedAmount=33.34, paidAmount=33.34 ✓ SETTLED
   - Expense status: SETTLED
```

---

## 🚀 Integration Steps

1. **Add Prisma Schema**
   ```bash
   cat SHARED_EXPENSE_SCHEMA.prisma >> prisma/schema.prisma
   ```

2. **Run Migration**
   ```bash
   npx prisma migrate dev --name add_shared_expenses
   ```

3. **Generate Prisma Types**
   ```bash
   npx prisma generate
   ```

4. **Implement Service Layer**
   - Use patterns from Transaction module
   - Apply same authorization checks
   - Use SplitCalculator for calculations

5. **Implement Controller Layer**
   - Follow Transaction controller pattern
   - Wire dependencies with DI

6. **Create Routes**
   - Map endpoints to controller methods
   - Add middleware for authentication

---

## ✅ Checklist

- ✅ Prisma schema with all models
- ✅ Type definitions (TypeScript)
- ✅ DTOs for all layer boundaries
- ✅ Custom exceptions (7 types)
- ✅ Split calculator utility
- ✅ Repository layer with queries
- ✅ Comprehensive documentation
- ⏳ Service layer (to be implemented)
- ⏳ Controller layer (to be implemented)
- ⏳ Routes (to be implemented)
- ⏳ Unit tests (to be implemented)

---

**Status:** ✅ Core Implementation Complete  
**Ready For:** Service/Controller implementation  
**Database:** PostgreSQL ready  
**Type Safety:** 100% TypeScript
