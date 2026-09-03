/**
 * Transaction Module - Comprehensive Architecture Documentation
 *
 * This document describes the refactored Transaction module following strict layered
 * architecture principles and FinTech best practices.
 *
 * @file README.md
 * @module transactions
 */

# Transaction Module - Architecture Guide

## Overview

The Transaction module implements a **layered architecture** for managing financial transactions with:

- ✅ Separation of concerns across HTTP, business logic, and data access layers
- ✅ Comprehensive input validation and error handling
- ✅ Security-first design with authorization checks
- ✅ Structured logging for audit trails and observability
- ✅ Type-safe implementation using TypeScript
- ✅ Domain-driven design with custom exceptions
- ✅ Full test coverage with Jest

---

## Layer Architecture

```
HTTP Request
    ↓
┌─────────────────────────────────────┐
│  Controllers (transaction.controller.ts)
│  ├─ Parse HTTP requests
│  ├─ Validate input format
│  └─ Build HTTP responses
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│  Validators (transaction.validator.ts)
│  ├─ UUID format validation
│  ├─ Amount range & precision checks
│  └─ Description length limits
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│  Services (transaction.service.ts)
│  ├─ Business logic execution
│  ├─ Authorization checks (defense-in-depth)
│  └─ Structured logging
└────────────┬────────────────────────┘
             ↓
┌─────────────────────────────────────┐
│  Repositories (transaction.repository.ts)
│  ├─ Database queries with Prisma
│  ├─ Transaction management
│  └─ Error handling
└────────────┬────────────────────────┘
             ↓
    PostgreSQL Database
```

---

## Component Responsibilities

### 1. **Controller Layer** (`transaction.controller.ts`)

Handles HTTP request/response lifecycle **only**.

**Responsibilities:**
- Parse and extract data from HTTP requests
- Call validator to validate input
- Extract authenticated user from middleware
- Invoke service methods with validated data
- Map exceptions to HTTP status codes
- Build JSON response payloads
- Log request/response metadata

**Should NOT contain:**
- ❌ Business logic
- ❌ Database queries
- ❌ Authorization rules
- ❌ Domain models

**Example:**
```typescript
async createTransaction(req: Request, res: Response): Promise<void> {
  // 1. Get authenticated user from middleware
  const authenticatedUserId = req.user?.id;
  
  // 2. Validate user ID
  this.validator.validateUserId(authenticatedUserId);
  
  // 3. Validate request payload
  this.validator.validateCreateTransactionRequest(req.body);
  
  // 4. Call service
  const result = await this.service.createTransaction(context, input);
  
  // 5. Return HTTP response
  res.status(201).json({ success: true, data: result });
}
```

---

### 2. **Validator Layer** (`transaction.validator.ts`)

Validates all input data before processing.

**Responsibilities:**
- Check required fields
- Validate data types
- Verify UUID format
- Check value ranges (min/max amounts)
- Verify decimal precision
- Validate field lengths
- Throw `TransactionValidationException` on failure

**Validation Rules:**
| Field | Rule | Example |
|-------|------|---------|
| `userId` | Valid UUID v4 | `550e8400-e29b-41d4-a716-446655440000` |
| `amount` | 0.01 - 999,999,999.99 | `100.50` |
| `amount` | Max 2 decimal places | ✅ `99.99`, ❌ `99.999` |
| `description` | Max 500 characters | ✅ "Payment for services" |
| `type` | One of enum values | `TRANSFER`, `DEPOSIT`, `WITHDRAWAL`, `PAYMENT` |

**Example:**
```typescript
validator.validateCreateTransactionRequest({
  amount: 100.50,
  type: "TRANSFER",
  description: "Payment"
});
// Throws TransactionValidationException if invalid
```

---

### 3. **Service Layer** (`transaction.service.ts`)

Executes all business logic and orchestration.

**Responsibilities:**
- Implement business rules
- Coordinate between controller and repository
- Perform authorization checks (defense-in-depth)
- Handle domain exceptions
- Execute complex operations
- Structured logging of business events
- Measure execution time

**IMPORTANT PRECONDITIONS:**
- Input MUST be validated by validator
- User MUST be authenticated by middleware
- User MUST be authorized by middleware
- Service assumes all preconditions are met

**Example:**
```typescript
async createTransaction(
  context: RequestContext,
  input: CreateTransactionInput
): Promise<TransactionResponse> {
  // Preconditions: Input already validated, user authenticated
  
  // 1. Execute business logic
  const transaction = await this.repository.create(input);
  
  // 2. Log business event
  this.logger.info({
    requestId: context.requestId,
    userId: context.authenticatedUserId,
    action: "CreateTransaction",
    amount: transaction.amount,
  });
  
  // 3. Return domain DTO
  return this.mapToDomain(transaction);
}
```

**Authorization (Defense-in-Depth):**
```typescript
// Middleware: Authenticates user and extracts userId
// Service: Verifies authorization again
if (context.authenticatedUserId !== userId) {
  throw new TransactionUnauthorizedException();
}
```

---

### 4. **Repository Layer** (`transaction.repository.ts`)

Handles all database interactions using Prisma ORM.

**Responsibilities:**
- Execute database queries
- Transform ORM models to domain models
- Implement pagination
- Handle database errors
- Manage transactions
- Validate database constraints

**Never:**
- ❌ Implement business logic
- ❌ Perform authorization
- ❌ Validate input
- ❌ Log business events

**Example:**
```typescript
async getByUserId(
  userId: string,
  limit: number,
  offset: number
): Promise<{ transactions: Transaction[]; total: number }> {
  // Fetch with pagination
  const [transactions, total] = await Promise.all([
    this.prisma.transaction.findMany({
      where: { userId },
      take: limit,
      skip: offset,
    }),
    this.prisma.transaction.count({
      where: { userId },
    }),
  ]);
  
  return { transactions, total };
}
```

---

### 5. **Types & Exceptions** (`transaction.types.ts`, `transaction.exceptions.ts`)

Domain-specific types and error classes.

**Exception Hierarchy:**
```
TransactionException (base)
├─ TransactionValidationException (400)
├─ TransactionUnauthorizedException (403)
├─ TransactionNotFoundException (404)
├─ InsufficientFundsException (400)
└─ TransactionDatabaseException (500)
```

**Usage:**
```typescript
throw new TransactionValidationException("Invalid amount", {
  field: "amount",
  value: "[REDACTED]",
  reason: "Must be between 0.01 and 999,999,999.99"
});
```

---

## Data Transfer Objects (DTOs)

Separate DTOs exist for each layer boundary:

### **Request DTO** (Controller Input)
```typescript
interface CreateTransactionRequest {
  amount: number;
  type: TransactionTypeEnum;
  description?: string;
}
```
*Used for validating incoming HTTP requests*

### **Input DTO** (Service Input)
```typescript
interface CreateTransactionInput {
  userId: string;
  amount: number;
  type: TransactionTypeEnum;
  description?: string;
}
```
*Used internally by service with authenticated user*

### **Response DTO** (HTTP Output)
```typescript
interface TransactionResponse {
  id: string;
  amount: number;
  type: TransactionTypeEnum;
  status: TransactionStatusEnum;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
```
*Does NOT expose internal details*

---

## Security Features

### **1. Authorization (Multiple Layers)**
```typescript
// Middleware: Authenticates user
// Controller: Checks user exists
// Service: Verifies authorization (defense-in-depth)
if (context.authenticatedUserId !== requestedUserId) {
  throw new TransactionUnauthorizedException();
}
```

### **2. Input Validation**
```typescript
// Validator checks:
validator.validateUserId(userId);           // UUID format
validator.validateCreateTransactionRequest(req.body);  // All fields
```

### **3. Amount Validation**
```typescript
if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
  throw new TransactionValidationException(...);
}
```

### **4. Pagination Limits (DoS Prevention)**
```typescript
const MAX_LIMIT = 1000;
const normalizedLimit = Math.min(limit, MAX_LIMIT);
// Prevents memory exhaustion from unbounded queries
```

### **5. Structured Logging**
```typescript
this.logger.info({
  requestId: context.requestId,  // Request tracing
  userId: context.authenticatedUserId,  // User identification
  action: "CreateTransaction",    // Action tracking
  amount: transaction.amount,     // Business event
  // ✅ userId field is NOT exposed to clients
  // ✅ sensitive amounts sanitized
});
```

---

## Usage Examples

### **Creating a Transaction**

```typescript
const controller = new TransactionController(service, validator, logger);

// HTTP: POST /api/v1/transactions
// Body: { "amount": 100.50, "type": "TRANSFER" }
// Result: 201 Created
const result = await controller.createTransaction(req, res);
```

### **Retrieving User Transactions**

```typescript
// HTTP: GET /api/v1/transactions?limit=50&offset=0
// Result: 200 OK with paginated transactions
const result = await controller.getTransactions(req, res);
```

### **Deleting All Transactions**

```typescript
// HTTP: DELETE /api/v1/transactions
// ⚠️ WARNING: Irreversible operation
// Result: 200 OK with deleted count
const result = await controller.deleteAllTransactions(req, res);
```

---

## Testing Strategy

### **Unit Tests** (`transaction.service.spec.ts`)

Tests focus on **service layer business logic**:

```typescript
describe("TransactionService", () => {
  describe("createTransaction", () => {
    it("should create transaction successfully", async () => {
      // Arrange: Set up mocks
      repository.create.mockResolvedValue(mockTransaction);
      
      // Act: Call service
      const result = await service.createTransaction(context, input);
      
      // Assert: Verify behavior
      expect(result.id).toBe("tx-123");
      expect(logger.info).toHaveBeenCalled();
    });
    
    it("should throw unauthorized for other user", async () => {
      // Test authorization logic
      await expect(
        service.getTransactionsByUser(context, otherUserId, pagination)
      ).rejects.toThrow(TransactionUnauthorizedException);
    });
  });
});
```

**Test Coverage Goals:**
- ✅ Happy path scenarios
- ✅ Error handling
- ✅ Authorization enforcement
- ✅ Logging behavior
- ✅ Pagination logic
- ✅ Exception throwing

---

## Error Handling

### **Controller Error Mapping**

```
TransactionValidationException → 400 Bad Request
TransactionUnauthorizedException → 403 Forbidden
TransactionNotFoundException → 404 Not Found
TransactionDatabaseException → 500 Internal Server Error
Unknown Error → 500 Internal Server Error (sanitized)
```

### **Example Error Response**

```json
{
  "success": false,
  "message": "Transaction validation failed",
  "code": "TRANSACTION_VALIDATION_ERROR",
  "details": {
    "amount": "Amount must be at least 0.01",
    "type": "Transaction type is required"
  }
}
```

---

## Logging & Observability

### **Info Level** (Success Events)
```typescript
{
  "requestId": "req-abc123",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "action": "CreateTransaction",
  "transactionId": "tx-456",
  "amount": "100.50",
  "type": "TRANSFER",
  "duration": 45,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### **Warn Level** (Security Events)
```typescript
{
  "requestId": "req-abc123",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "action": "GetTransactionsByUser",
  "reason": "Unauthorized access attempt",
  "attemptedUserId": "[REDACTED]",
  "severity": "HIGH",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### **Error Level** (Failures)
```typescript
{
  "requestId": "req-abc123",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "action": "CreateTransaction",
  "error": "Database connection failed",
  "duration": 5000,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Deployment Checklist

- [ ] All input validation in place
- [ ] Authorization checks implemented
- [ ] Structured logging configured
- [ ] Error handling tested
- [ ] Database indexes created (see schema)
- [ ] Rate limiting configured
- [ ] HTTPS enabled
- [ ] Request ID middleware active
- [ ] Authentication middleware active
- [ ] Monitoring/alerting configured

---

## Related Files

- [Copilot Instructions](../../.github/copilot-instructions.md)
- [Architecture Documentation](../../ARCHITECTURE.md)
- [Prisma Schema](../../prisma/schema.prisma)

