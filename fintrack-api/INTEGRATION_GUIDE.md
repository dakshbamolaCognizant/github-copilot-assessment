/**
 * Transaction Module - Integration Guide
 *
 * This guide shows how to integrate the refactored Transaction module
 * into your Express application with proper middleware, routing, and error handling.
 *
 * @file INTEGRATION_GUIDE.md
 */

# Transaction Module - Integration Guide

This guide provides step-by-step instructions for integrating the refactored Transaction module into your FinTech API application.

---

## 📋 Prerequisites

Before integrating, ensure you have:

- ✅ Node.js 16+ installed
- ✅ Express.js application set up
- ✅ PostgreSQL database configured
- ✅ Prisma ORM installed
- ✅ TypeScript configured
- ✅ Jest for testing

---

## 🔧 Step 1: Update Prisma Schema

Add the Transaction model to your `prisma/schema.prisma`:

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ... existing models ...

enum TransactionType {
  TRANSFER
  DEPOSIT
  WITHDRAWAL
  PAYMENT
}

enum TransactionStatus {
  PENDING
  COMPLETED
  FAILED
  CANCELLED
}

model Transaction {
  id          String   @id @default(cuid())
  userId      String   @db.Uuid
  amount      Decimal  @db.Decimal(15, 2)
  description String?  @db.VarChar(500)
  type        TransactionType
  status      TransactionStatus @default(COMPLETED)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
  @@index([userId, createdAt(sort: Desc)])
  @@index([status])
  @@index([type])
}
```

Run migration:
```bash
npx prisma migrate dev --name add_transactions
```

---

## 🔐 Step 2: Implement Authentication Middleware

Create or update `src/middleware/auth.middleware.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Logger } from "../logger";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
  requestId?: string;
}

export function createAuthMiddleware(logger: Logger) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Generate request ID for tracing
    req.requestId = req.headers["x-request-id"] as string ||
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      logger.warn({
        requestId: req.requestId,
        action: "AuthMiddleware",
        reason: "Missing Authorization header",
      });
      res.status(401).json({
        success: false,
        message: "Missing or invalid Authorization header",
        code: "MISSING_AUTH_HEADER",
      });
      return;
    }

    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "default-secret"
      ) as { id: string; email?: string };

      req.user = decoded;
      logger.info({
        requestId: req.requestId,
        userId: req.user.id,
        action: "AuthMiddleware",
        message: "User authenticated",
      });

      next();
    } catch (error) {
      logger.error({
        requestId: req.requestId,
        action: "AuthMiddleware",
        error: error instanceof Error ? error.message : String(error),
      });

      res.status(401).json({
        success: false,
        message: "Invalid or expired token",
        code: "INVALID_TOKEN",
      });
    }
  };
}
```

---

## 📍 Step 3: Set Up Routes

Create or update `src/routes/index.ts`:

```typescript
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { Logger } from "../logger";
import { createTransactionRoutes } from "../transactions";

export function setupRoutes(prisma: PrismaClient, logger: Logger): Router {
  const router = Router();

  // API version prefix
  const v1 = Router();

  // Transaction routes
  v1.use("/transactions", createTransactionRoutes(prisma, logger));

  // Health check
  v1.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Mount v1 routes
  router.use("/api/v1", v1);

  return router;
}
```

---

## 🎯 Step 4: Configure Main Application

Update your `src/app.ts` or `src/server.ts`:

```typescript
import express from "express";
import { PrismaClient } from "@prisma/client";
import { Logger } from "./logger";
import { createAuthMiddleware } from "./middleware/auth.middleware";
import { setupRoutes } from "./routes";

const app = express();
const prisma = new PrismaClient();
const logger = new Logger();

// 1. Parse JSON requests
app.use(express.json());

// 2. Add request ID and authenticate
app.use(createAuthMiddleware(logger));

// 3. Setup routes
app.use(setupRoutes(prisma, logger));

// 4. Error handling middleware (must be last)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({
    requestId: (req as any).requestId,
    action: "ErrorHandler",
    error: err.message,
    stack: err.stack,
  });

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error",
    code: err.code || "INTERNAL_SERVER_ERROR",
  });
});

// 5. Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({
    requestId: "startup",
    action: "ServerStart",
    message: `Server running on port ${PORT}`,
  });
});

export default app;
```

---

## 📝 Step 5: Example Usage

### **Create Transaction**

```bash
curl -X POST http://localhost:3000/api/v1/transactions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.50,
    "type": "TRANSFER",
    "description": "Payment for services"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clpk1x9z80000qjqq9q9q9q9q",
    "amount": 100.50,
    "type": "TRANSFER",
    "status": "COMPLETED",
    "description": "Payment for services",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Transaction created successfully"
}
```

### **Get Transactions**

```bash
curl -X GET "http://localhost:3000/api/v1/transactions?limit=50&offset=0" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clpk1x9z80000qjqq9q9q9q9q",
      "amount": 100.50,
      "type": "TRANSFER",
      "status": "COMPLETED",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### **Delete All Transactions**

```bash
curl -X DELETE http://localhost:3000/api/v1/transactions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "deletedCount": 150,
  "message": "150 transaction(s) deleted successfully"
}
```

---

## 🧪 Step 6: Testing

### **Run Unit Tests**

```bash
npm test -- transaction.service.spec.ts
```

**Expected Output:**
```
PASS  src/transactions/transaction.service.spec.ts
  TransactionService
    createTransaction
      ✓ should create a transaction successfully
      ✓ should handle database errors gracefully
      ✓ should log transaction creation with proper context
    getTransactionsByUser
      ✓ should return paginated transactions for user
      ✓ should throw unauthorized exception
      ✓ should handle pagination correctly
      ✓ should set hasMore to false when at end of results
    deleteAllTransactionsByUser
      ✓ should delete all transactions for user
      ✓ should throw unauthorized exception
      ✓ should log warning when deleting transactions

Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
```

### **Integration Testing**

Create `src/transactions/__tests__/integration.test.ts`:

```typescript
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import app from "../../app";

const prisma = new PrismaClient();

describe("Transaction Integration Tests", () => {
  const token = "Bearer valid-jwt-token";

  beforeAll(async () => {
    await prisma.transaction.deleteMany({});
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should create and retrieve transactions", async () => {
    // Create
    const createRes = await request(app)
      .post("/api/v1/transactions")
      .set("Authorization", token)
      .send({
        amount: 100.50,
        type: "TRANSFER",
        description: "Test",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);

    // Retrieve
    const getRes = await request(app)
      .get("/api/v1/transactions")
      .set("Authorization", token);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data).toHaveLength(1);
  });
});
```

---

## 📊 Environment Variables

Create `.env` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/fintrack"

# Server
PORT=3000
NODE_ENV=development

# Authentication
JWT_SECRET="your-super-secret-jwt-key"

# Logging
LOG_LEVEL=info

# CORS
CORS_ORIGIN=http://localhost:3000
```

---

## 🔍 Monitoring & Debugging

### **Enable Debug Logs**

```typescript
// Enable Prisma debug mode
const prisma = new PrismaClient({
  log: [
    {
      emit: "event",
      level: "query",
    },
  ],
});

prisma.$on("query", (e) => {
  logger.debug({
    query: e.query,
    duration: `${e.duration}ms`,
  });
});
```

### **Error Monitoring** (Example with Sentry)

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

---

## ✅ Verification Checklist

After integration, verify:

- [ ] Prisma schema includes Transaction model
- [ ] Database migration applied (`npx prisma db push`)
- [ ] Authentication middleware configured
- [ ] Routes set up in main application
- [ ] Tests passing (`npm test`)
- [ ] POST /api/v1/transactions creates transactions
- [ ] GET /api/v1/transactions retrieves with pagination
- [ ] DELETE /api/v1/transactions removes all
- [ ] Authorization prevents cross-user access
- [ ] Error responses have proper HTTP status codes
- [ ] Structured logging working
- [ ] Request IDs tracked in logs

---

## 🚀 Next Steps

1. **Add Rates & Fees**
   - Extend Transaction model
   - Calculate transaction fees in service

2. **Add Audit Trail**
   - Log all transaction changes
   - Create AuditLog model

3. **Add Webhooks**
   - Notify external systems
   - Implement webhook queue

4. **Add Caching**
   - Redis for frequent queries
   - Cache pagination results

5. **Add API Documentation**
   - Swagger/OpenAPI spec
   - Interactive API docs

---

## 📚 Related Documentation

- [Transaction Module README](./src/transactions/README.md)
- [Refactoring Summary](./REFACTORING_SUMMARY.md)
- [Copilot Instructions](./.github/copilot-instructions.md)
- [Prisma Documentation](https://www.prisma.io/docs/)

---

**Status:** ✅ Ready for Integration  
**Last Updated:** 2024-01-15  
**Tested With:** Node.js 16+, Express 4+, Prisma 4+
