# Copilot Instructions

## Project Overview

This is a FinTech REST API built with:

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Jest

The project follows a layered architecture with a strong focus on security, maintainability, reliability, and testability.

---

## Architecture Guidelines

Follow the layered structure:

```text
src/
├── controllers/
├── services/
├── repositories/
├── routes/
├── middleware/
├── validators/
├── utils/
├── logger/
├── prisma/
└── tests/
```

Responsibilities:

- Controllers: Handle HTTP requests/responses only.
- Services: Implement business logic.
- Repositories: Handle database operations using Prisma.
- Validators: Validate request data.
- Middleware: Authentication, authorization, error handling, logging.

---

## TypeScript Standards

- Use strict TypeScript typing.
- Avoid `any`.
- Prefer interfaces and DTOs.
- Use enums for constant values.
- Ensure all functions have explicit return types.

Example:

```typescript
interface CreateAccountRequest {
  customerId: string;
  accountType: string;
}
```

---

## Prisma Guidelines

- Use Prisma Client for all database interactions.
- Keep queries in repository classes.
- Use transactions for financial operations.
- Never execute raw SQL unless absolutely required.
- Handle database errors gracefully.

---

## Validation Rules

- Validate all incoming request data.
- Reject invalid payloads with meaningful error messages.
- Validate:
  - Required fields
  - Data types
  - Amount ranges
  - UUID formats
  - Dates and enums

---

## Security Requirements

Always:

- Hash passwords using bcrypt.
- Store secrets in environment variables.
- Implement authentication and authorization.
- Sanitize inputs.
- Use HTTPS in all environments.
- Apply rate limiting.
- Mask sensitive data in logs.
- Never log passwords, tokens, card numbers, or CVVs.

---

## Logging Standards

Use structured logging.

Log:

- Request ID
- User ID
- API endpoint
- Execution time
- Errors

Avoid logging sensitive customer or financial information.

Example:

```typescript
logger.info({
  requestId,
  userId,
  action: "CreateAccount"
});
```

---

## Error Handling

- Use centralized error middleware.
- Return consistent API responses.
- Do not expose internal stack traces.

Example:

```json
{
  "success": false,
  "message": "Invalid account ID"
}
```

---

## Unit Testing Standards

Use Jest for unit testing.

Requirements:

- Test all service-layer business logic.
- Mock repositories and external dependencies.
- Follow Arrange-Act-Assert pattern.
- Cover positive and negative scenarios.
- Aim for 80%+ code coverage.

Example test name:

```typescript
describe("TransferService", () => {
  it("should transfer funds successfully");
  it("should throw error for insufficient balance");
});
```

---

## Code Quality

- Keep functions small and focused.
- Follow SOLID principles.
- Avoid code duplication.
- Write self-documenting code.
- Add comments only when business logic is complex.

---

## Copilot Expectations

When generating code:

1. Follow layered architecture.
2. Use TypeScript strict typing.
3. Apply Prisma best practices.
4. Include input validation.
5. Implement proper error handling.
6. Follow FinTech security standards.
7. Generate accompanying Jest unit tests.
8. Produce clean, maintainable, and production-ready code.