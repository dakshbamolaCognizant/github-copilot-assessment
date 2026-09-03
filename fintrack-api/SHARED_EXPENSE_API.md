/**
 * Shared Expense API - Complete Endpoint Documentation
 *
 * This document provides complete examples for all shared expense API endpoints.
 *
 * @file SHARED_EXPENSE_API.md
 */

# Shared Expense API Documentation

## Base URL
```
https://api.fintrack.com/api/v1
```

## Authentication
All endpoints require Bearer token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

---

## Table of Contents

1. [Create Shared Expense](#create-shared-expense)
2. [Get Expenses by Creator](#get-expenses-by-creator)
3. [Get Expenses as Participant](#get-expenses-as-participant)
4. [Get Specific Expense](#get-specific-expense)
5. [Record Settlement Payment](#record-settlement-payment)
6. [Get Net User Balance](#get-net-user-balance)
7. [Get Optimal Settlements](#get-optimal-settlements)
8. [Error Responses](#error-responses)
9. [Split Types Guide](#split-types-guide)
10. [Real-World Examples](#real-world-examples)

---

## Create Shared Expense

### Endpoint
```
POST /expenses
```

### Description
Creates a new shared expense with automatic split calculation. The creator is automatically included as a participant.

### Request Headers
```
Content-Type: application/json
Authorization: Bearer <token>
```

### Request Body

#### Equal Split (Default)
```json
{
  "description": "Restaurant dinner",
  "totalAmount": 120.50,
  "splitType": "EQUAL",
  "participantIds": ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"],
  "category": "DINING",
  "notes": "Italian restaurant",
  "expenseDate": "2024-01-15T19:30:00Z"
}
```

#### Percentage Split (Income-Proportional)
```json
{
  "description": "Monthly apartment rent",
  "totalAmount": 3000.00,
  "splitType": "BY_PERCENTAGE",
  "participantIds": ["alice-id", "bob-id", "charlie-id"],
  "splitConfig": {
    "type": "BY_PERCENTAGE",
    "splits": {
      "alice-id": 50,
      "bob-id": 30,
      "charlie-id": 20
    }
  },
  "category": "HOUSING",
  "expenseDate": "2024-01-01T00:00:00Z"
}
```

#### Custom Amount Split
```json
{
  "description": "Group purchase",
  "totalAmount": 150.00,
  "splitType": "BY_AMOUNT",
  "participantIds": ["user-1", "user-2", "user-3"],
  "splitConfig": {
    "type": "BY_AMOUNT",
    "splits": {
      "user-1": 60.00,
      "user-2": 50.00,
      "user-3": 40.00
    }
  },
  "notes": "Different quantities purchased"
}
```

#### Itemized Split
```json
{
  "description": "Restaurant bill split by items",
  "totalAmount": 125.80,
  "splitType": "ITEMIZED",
  "participantIds": ["alice", "bob", "charlie", "diana"],
  "splitConfig": {
    "type": "ITEMIZED",
    "items": [
      {"name": "Steak", "amount": 35.00, "claimedByUserId": "alice"},
      {"name": "Fish", "amount": 32.50, "claimedByUserId": "bob"},
      {"name": "Pasta", "amount": 28.30, "claimedByUserId": "charlie"},
      {"name": "Salad", "amount": 25.00, "claimedByUserId": "diana"},
      {"name": "Service charge", "amount": 5.00, "claimedByUserId": "alice"}
    ]
  },
  "notes": "Restaurant: Bella Italia"
}
```

### Request Parameters
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| description | string | Yes | - | Expense description |
| totalAmount | number | Yes | - | Total amount (must be > 0) |
| splitType | enum | Yes | - | EQUAL, BY_AMOUNT, BY_PERCENTAGE, ITEMIZED |
| participantIds | string[] | Yes | - | At least 2 users, includes creator |
| splitConfig | object | Conditional | - | Required for BY_AMOUNT, BY_PERCENTAGE, ITEMIZED |
| category | enum | No | - | DINING, HOUSING, UTILITIES, ENTERTAINMENT, TRAVEL, etc. |
| notes | string | No | - | Additional notes |
| expenseDate | ISO8601 | No | now | When the expense occurred |

### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "creatorId": "550e8400-e29b-41d4-a716-446655440000",
    "description": "Restaurant dinner",
    "totalAmount": 120.50,
    "splitType": "EQUAL",
    "status": "PENDING",
    "category": "DINING",
    "notes": "Italian restaurant",
    "expenseDate": "2024-01-15T19:30:00Z",
    "participants": [
      {
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "owedAmount": 40.17,
        "paidAmount": 0,
        "balanceRemaining": 40.17
      },
      {
        "userId": "550e8400-e29b-41d4-a716-446655440001",
        "owedAmount": 40.17,
        "paidAmount": 0,
        "balanceRemaining": 40.17
      },
      {
        "userId": "550e8400-e29b-41d4-a716-446655440002",
        "owedAmount": 40.16,
        "paidAmount": 0,
        "balanceRemaining": 40.16
      }
    ],
    "createdAt": "2024-01-15T20:00:00Z",
    "updatedAt": "2024-01-15T20:00:00Z"
  },
  "message": "Shared expense created successfully"
}
```

### Error Responses

#### 400: Invalid Request
```json
{
  "success": false,
  "message": "Invalid split configuration",
  "code": "INVALID_SPLIT_CONFIG",
  "details": {
    "reason": "Split amounts must sum to total"
  }
}
```

#### 401: Unauthorized
```json
{
  "success": false,
  "message": "Authentication required",
  "code": "AUTHENTICATION_REQUIRED"
}
```

#### 403: Creator Not in Participants
```json
{
  "success": false,
  "message": "Creator must be included as participant",
  "code": "CREATOR_NOT_PARTICIPANT"
}
```

---

## Get Expenses by Creator

### Endpoint
```
GET /expenses/created?limit=100&offset=0
```

### Description
Retrieves all expenses created by the authenticated user with pagination.

### Query Parameters
| Parameter | Type | Required | Default | Range |
|-----------|------|----------|---------|-------|
| limit | integer | No | 100 | 1-1000 |
| offset | integer | No | 0 | ≥0 |

### Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "creatorId": "550e8400-e29b-41d4-a716-446655440000",
      "description": "Restaurant dinner",
      "totalAmount": 120.50,
      "splitType": "EQUAL",
      "status": "PARTIALLY_PAID",
      "category": "DINING",
      "participants": [
        {
          "userId": "550e8400-e29b-41d4-a716-446655440000",
          "owedAmount": 40.17,
          "paidAmount": 40.17,
          "balanceRemaining": 0
        }
      ],
      "createdAt": "2024-01-15T20:00:00Z",
      "updatedAt": "2024-01-15T21:30:00Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 5,
    "hasMore": false
  }
}
```

### Statuses
- **PENDING**: No payments recorded yet
- **PARTIALLY_PAID**: Some participants have paid
- **SETTLED**: All participants have paid their full share
- **CANCELLED**: Expense was cancelled

---

## Get Expenses as Participant

### Endpoint
```
GET /expenses/participating?limit=100&offset=0
```

### Description
Retrieves all expenses where the authenticated user is a participant (but didn't create).

### Query Parameters
Same as [Get Expenses by Creator](#get-expenses-by-creator)

### Response
Same format as [Get Expenses by Creator](#get-expenses-by-creator)

---

## Get Specific Expense

### Endpoint
```
GET /expenses/{expenseId}
```

### URL Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| expenseId | uuid | Yes | The expense ID |

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "creatorId": "550e8400-e29b-41d4-a716-446655440000",
    "description": "Restaurant dinner",
    "totalAmount": 120.50,
    "splitType": "EQUAL",
    "status": "PARTIALLY_PAID",
    "category": "DINING",
    "notes": "Italian restaurant",
    "expenseDate": "2024-01-15T19:30:00Z",
    "participants": [
      {
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "owedAmount": 40.17,
        "paidAmount": 40.17,
        "balanceRemaining": 0
      },
      {
        "userId": "550e8400-e29b-41d4-a716-446655440001",
        "owedAmount": 40.17,
        "paidAmount": 0,
        "balanceRemaining": 40.17
      },
      {
        "userId": "550e8400-e29b-41d4-a716-446655440002",
        "owedAmount": 40.16,
        "paidAmount": 0,
        "balanceRemaining": 40.16
      }
    ],
    "createdAt": "2024-01-15T20:00:00Z",
    "updatedAt": "2024-01-15T21:30:00Z"
  }
}
```

### Error Responses

#### 404: Expense Not Found
```json
{
  "success": false,
  "message": "Expense not found",
  "code": "EXPENSE_NOT_FOUND"
}
```

#### 403: Access Denied
```json
{
  "success": false,
  "message": "You do not have access to this expense",
  "code": "UNAUTHORIZED"
}
```

---

## Record Settlement Payment

### Endpoint
```
POST /expenses/{expenseId}/settle
```

### URL Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| expenseId | uuid | Yes | The expense ID |

### Request Body

```json
{
  "amount": 40.17,
  "paidByUserId": "550e8400-e29b-41d4-a716-446655440001",
  "paymentMethod": "BANK_TRANSFER",
  "transactionReference": "TXN-12345-ABCDE"
}
```

### Request Parameters
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| amount | number | Yes | Payment amount (must be > 0, ≤ remaining balance) |
| paidByUserId | uuid | Yes | Must match authenticated user (can't pay for others) |
| paymentMethod | enum | No | BANK_TRANSFER, CASH, CARD, UPI, etc. |
| transactionReference | string | No | External transaction ID for tracking |

### Response (200 OK)

```json
{
  "success": true,
  "expenseId": "550e8400-e29b-41d4-a716-446655440000",
  "participantUserId": "550e8400-e29b-41d4-a716-446655440001",
  "paymentRecorded": 40.17,
  "newBalance": 0,
  "expenseStatus": "PARTIALLY_PAID"
}
```

### Error Responses

#### 400: Invalid Payment Amount
```json
{
  "success": false,
  "message": "Payment amount exceeds remaining debt",
  "code": "OVERPAYMENT",
  "details": {
    "requestedPayment": 50.00,
    "remainingDebt": 40.17
  }
}
```

#### 403: Cannot Pay Another User's Balance
```json
{
  "success": false,
  "message": "Can only record your own payments",
  "code": "UNAUTHORIZED_PAYMENT"
}
```

---

## Get Net User Balance

### Endpoint
```
GET /expenses/balance/net
```

### Description
Retrieves the user's overall financial position across all shared expenses.

### Query Parameters
None

### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "totalOwed": 500.00,
    "totalPaid": 250.00,
    "netBalance": 250.00,
    "expenseCount": 3
  }
}
```

### Response Fields
| Field | Type | Description |
|-------|------|-------------|
| userId | uuid | User ID |
| totalOwed | number | Sum of all amounts owed across all expenses |
| totalPaid | number | Sum of all amounts paid across all expenses |
| netBalance | number | totalOwed - totalPaid (positive = owes, negative = owed) |
| expenseCount | integer | Number of expenses user participates in |

### Interpretation
- **netBalance > 0**: User still owes money overall
- **netBalance < 0**: User is owed money overall (has overpaid)
- **netBalance ≈ 0**: User is fully settled

### Example Scenarios

#### Scenario 1: User Owes Money
```json
{
  "userId": "user-123",
  "totalOwed": 500,
  "totalPaid": 250,
  "netBalance": 250,
  "expenseCount": 3
}
// Interpretation: User needs to pay $250 more
```

#### Scenario 2: User Is Owed Money
```json
{
  "userId": "user-123",
  "totalOwed": 300,
  "totalPaid": 400,
  "netBalance": -100,
  "expenseCount": 2
}
// Interpretation: User is owed $100 (overpaid)
```

#### Scenario 3: User Is Settled
```json
{
  "userId": "user-123",
  "totalOwed": 150,
  "totalPaid": 150,
  "netBalance": 0,
  "expenseCount": 1
}
// Interpretation: User has paid their full share
```

---

## Get Optimal Settlements

### Endpoint
```
GET /expenses/{expenseId}/settlements/optimal
```

### URL Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| expenseId | uuid | Yes | The expense ID |

### Description
Returns the minimum number of payments needed to settle all debts for an expense.

Uses Algorithm 7 (Greedy Matching):
1. Calculates net balance for each participant
2. Separates into creditors (owed money) and debtors (owe money)
3. Matches largest amounts together
4. Returns minimum transactions needed

### Response (200 OK)

```json
{
  "success": true,
  "expenseId": "550e8400-e29b-41d4-a716-446655440000",
  "settlements": [
    {
      "from": "550e8400-e29b-41d4-a716-446655440001",
      "to": "550e8400-e29b-41d4-a716-446655440000",
      "amount": 40.17
    },
    {
      "from": "550e8400-e29b-41d4-a716-446655440002",
      "to": "550e8400-e29b-41d4-a716-446655440000",
      "amount": 40.16
    }
  ]
}
```

### Response Fields
| Field | Type | Description |
|-------|------|-------------|
| success | boolean | Operation succeeded |
| expenseId | uuid | The expense ID |
| settlements | array | List of optimal transactions |
| settlements[].from | uuid | Payer user ID (debtor) |
| settlements[].to | uuid | Payee user ID (creditor) |
| settlements[].amount | number | Amount to transfer |

### Example: Restaurant Bill

**Scenario:**
- Total: $120, split equally ($30 each, with rounding)
- Alice paid: $120 (owes $30)
- Bob: paid $0 (owes $30)
- Charlie: paid $0 (owes $30)
- Diana: paid $0 (owes $30)

**Without Optimization:**
Could have 9+ potential payment combinations

**With Algorithm 7 (Optimal):**
```json
{
  "settlements": [
    { "from": "bob", "to": "alice", "amount": 30 },
    { "from": "charlie", "to": "alice", "amount": 30 },
    { "from": "diana", "to": "alice", "amount": 30 }
  ]
}
// Result: 3 payments (minimum possible)
```

**Benefits:**
- Minimizes number of transfers
- Reduces transaction fees
- Faster settlement
- Deterministic results

---

## Error Responses

### Common Error Formats

#### Validation Error (400)
```json
{
  "success": false,
  "message": "Invalid request",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "totalAmount",
    "reason": "Must be greater than 0"
  }
}
```

#### Authorization Error (403)
```json
{
  "success": false,
  "message": "Forbidden",
  "code": "UNAUTHORIZED",
  "details": {
    "reason": "Only creator can view this expense"
  }
}
```

#### Not Found Error (404)
```json
{
  "success": false,
  "message": "Expense not found",
  "code": "NOT_FOUND",
  "details": {
    "expenseId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

#### Database Error (500)
```json
{
  "success": false,
  "message": "Internal server error",
  "code": "DATABASE_ERROR"
}
```

---

## Split Types Guide

### 1. EQUAL Split

**Use When:** Everyone should pay the same amount

**How It Works:**
- Divides total equally among all participants
- Handles rounding by giving remainder to last participant
- Example: $100 / 3 = $33.33, $33.33, $33.34

**Best For:**
- Restaurant bills split equally
- Shared apartment utilities
- Group activity costs

**Example:**
```json
{
  "totalAmount": 100,
  "splitType": "EQUAL",
  "participantIds": ["alice", "bob", "charlie"]
}
```

### 2. BY_AMOUNT Split

**Use When:** People ordered different amounts or have fixed contributions

**How It Works:**
- Each participant has specific dollar amount
- Must sum to total amount
- No calculations needed

**Best For:**
- Restaurant bills with different items
- Expenses with unequal consumption
- Reimbursement scenarios

**Example:**
```json
{
  "totalAmount": 150,
  "splitType": "BY_AMOUNT",
  "participantIds": ["alice", "bob", "charlie"],
  "splitConfig": {
    "type": "BY_AMOUNT",
    "splits": {
      "alice": 60,
      "bob": 50,
      "charlie": 40
    }
  }
}
```

### 3. BY_PERCENTAGE Split

**Use When:** Payment should be proportional (e.g., by income)

**How It Works:**
- Each participant has percentage (0-100)
- Percentages must sum to 100%
- Amount calculated as: `total × percentage / 100`

**Best For:**
- Income-proportional rent split
- Profit sharing
- Benefit distribution
- Weighted responsibility

**Example:**
```json
{
  "totalAmount": 3000,
  "splitType": "BY_PERCENTAGE",
  "participantIds": ["alice", "bob", "charlie"],
  "splitConfig": {
    "type": "BY_PERCENTAGE",
    "splits": {
      "alice": 50,
      "bob": 30,
      "charlie": 20
    }
  }
}
```

### 4. ITEMIZED Split

**Use When:** Tracking individual items per person

**How It Works:**
- Each item is assigned to a specific participant
- Person pays for items they claimed
- Items are aggregated by person

**Best For:**
- Restaurant bills with individual items
- Grocery shopping
- Retail purchases with different claims
- Services consumed differently

**Example:**
```json
{
  "totalAmount": 125.80,
  "splitType": "ITEMIZED",
  "participantIds": ["alice", "bob", "charlie", "diana"],
  "splitConfig": {
    "type": "ITEMIZED",
    "items": [
      {"name": "Steak", "amount": 35, "claimedByUserId": "alice"},
      {"name": "Fish", "amount": 32.50, "claimedByUserId": "bob"},
      {"name": "Pasta", "amount": 28.30, "claimedByUserId": "charlie"},
      {"name": "Salad", "amount": 25, "claimedByUserId": "diana"},
      {"name": "Service", "amount": 5, "claimedByUserId": "alice"}
    ]
  }
}
```

---

## Real-World Examples

### Example 1: Restaurant Bill (Equal Split)

**Scenario:**
Four friends have dinner. Total bill: $125.80. They want to split equally.

**Request:**
```bash
curl -X POST https://api.fintrack.com/api/v1/expenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "description": "Dinner at Bella Italia",
    "totalAmount": 125.80,
    "splitType": "EQUAL",
    "participantIds": [
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
      "550e8400-e29b-41d4-a716-446655440003"
    ],
    "category": "DINING"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "exp-001",
    "totalAmount": 125.80,
    "participants": [
      {"userId": "user1", "owedAmount": 31.45, "paidAmount": 0},
      {"userId": "user2", "owedAmount": 31.45, "paidAmount": 0},
      {"userId": "user3", "owedAmount": 31.45, "paidAmount": 0},
      {"userId": "user4", "owedAmount": 31.45, "paidAmount": 0}
    ]
  }
}
```

### Example 2: Apartment Rent (Percentage Split)

**Scenario:**
Three roommates share $3000 rent based on income:
- Alice: 50% ($1500)
- Bob: 30% ($900)
- Charlie: 20% ($600)

**Request:**
```bash
curl -X POST https://api.fintrack.com/api/v1/expenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "description": "January 2024 Rent",
    "totalAmount": 3000,
    "splitType": "BY_PERCENTAGE",
    "participantIds": ["alice", "bob", "charlie"],
    "splitConfig": {
      "type": "BY_PERCENTAGE",
      "splits": {"alice": 50, "bob": 30, "charlie": 20}
    },
    "category": "HOUSING",
    "expenseDate": "2024-01-01T00:00:00Z"
  }'
```

### Example 3: Full Settlement Flow

**Step 1: Create Expense**
Alice creates an expense: 4 people, $120 bill, equal split

**Step 2: Get Optimal Settlements**
```bash
curl -X GET "https://api.fintrack.com/api/v1/expenses/exp-123/settlements/optimal" \
  -H "Authorization: Bearer <alice-token>"
```

**Response:**
```json
{
  "success": true,
  "settlements": [
    {"from": "bob", "to": "alice", "amount": 30},
    {"from": "charlie", "to": "alice", "amount": 30},
    {"from": "diana", "to": "alice", "amount": 30}
  ]
}
```

**Step 3: Record Payments**
Bob pays Alice $30:
```bash
curl -X POST "https://api.fintrack.com/api/v1/expenses/exp-123/settle" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <bob-token>" \
  -d '{"amount": 30, "paidByUserId": "bob"}'
```

**Step 4: Check Balance**
```bash
curl -X GET "https://api.fintrack.com/api/v1/expenses/balance/net" \
  -H "Authorization: Bearer <alice-token>"
```

Returns Alice's overall balance across all expenses.

---

## Rate Limiting

All endpoints are rate limited:
- **Per user**: 1000 requests/hour
- **Per IP**: 10000 requests/hour

Headers returned:
- `X-RateLimit-Limit`: 1000
- `X-RateLimit-Remaining`: 999
- `X-RateLimit-Reset`: 1705334400

---

## Pagination

For list endpoints (`/created`, `/participating`):

**Request:**
```
GET /expenses/created?limit=50&offset=100
```

**Response includes:**
```json
{
  "pagination": {
    "limit": 50,
    "offset": 100,
    "total": 250,
    "hasMore": true
  }
}
```

**Navigation:**
- First page: `offset=0, limit=50`
- Next page: `offset=50, limit=50`
- Previous page: `offset=0, limit=50` (go back)
- Last page: Calculate `offset` so `offset + limit >= total`

---

## Best Practices

### 1. Always Verify Split Configuration
Before creating an expense, verify amounts or percentages sum correctly.

### 2. Use Optimal Settlements
Always get optimal settlements before asking users to pay:
```bash
GET /expenses/{expenseId}/settlements/optimal
```

### 3. Track Net Balance
Check user's net balance periodically:
```bash
GET /expenses/balance/net
```

### 4. Handle Errors Gracefully
Always check `success` field and handle error codes appropriately.

### 5. Use Request IDs
Include `X-Request-ID` header for tracing:
```
X-Request-ID: <unique-id>
```

### 6. Idempotency
Use idempotency keys for settlement payments:
```
Idempotency-Key: <unique-payment-id>
```

---

## Webhooks (Coming Soon)

Planned webhooks:
- `expense.created`
- `settlement.recorded`
- `expense.settled`
- `payment.failed`

---

## SDK Examples

### JavaScript/Node.js
```typescript
const expense = await fintrackClient.expenses.create({
  description: "Dinner",
  totalAmount: 120,
  splitType: "EQUAL",
  participantIds: [...],
});

const balance = await fintrackClient.expenses.getNetBalance();
```

### Python
```python
expense = client.expenses.create(
    description="Dinner",
    total_amount=120,
    split_type="EQUAL",
    participant_ids=[...],
)

balance = client.expenses.get_net_balance()
```

---

## Support

For issues or questions:
- Email: api-support@fintrack.com
- Slack: #fintech-api-support
- GitHub Issues: github.com/fintech/api/issues
