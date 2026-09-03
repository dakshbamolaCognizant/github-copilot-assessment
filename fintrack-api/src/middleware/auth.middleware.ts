/**
 * Authentication Middleware Example
 *
 * This middleware:
 * 1. Verifies JWT token from Authorization header
 * 2. Extracts user information
 * 3. Attaches user to request object
 * 4. Passes request ID for tracing
 *
 * This middleware MUST run before Transaction controller methods.
 *
 * @example
 * app.use(authMiddleware);
 * app.use('/api/v1/transactions', createTransactionRoutes(prisma, logger));
 */

import { Request, Response, NextFunction } from "express";
import { Logger } from "./logger";

/**
 * Extended Express Request with user and requestId
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
  requestId?: string;
}

/**
 * Authentication middleware
 * Verifies JWT token and extracts user information
 *
 * @param logger - Logger instance
 * @returns Express middleware function
 */
export function createAuthMiddleware(logger: Logger) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Generate request ID for tracing
    req.requestId =
      req.headers["x-request-id"] ||
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Extract Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn({
        requestId: req.requestId,
        action: "AuthMiddleware",
        reason: "Missing or invalid Authorization header",
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

      // TODO: Verify JWT token (using jsonwebtoken library)
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // MOCK: For demonstration
      const mockDecoded = {
        id: "550e8400-e29b-41d4-a716-446655440000", // From token
        email: "user@example.com",
      };

      // Attach authenticated user to request
      req.user = mockDecoded;

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

/**
 * Authorization middleware for transaction routes
 * Ensures user can only access their own transactions
 *
 * @param logger - Logger instance
 * @returns Express middleware function
 */
export function createTransactionAuthorizationMiddleware(logger: Logger) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authenticatedUserId = req.user?.id;
    const requestedUserId = req.params.userId || req.body?.userId;

    if (!authenticatedUserId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "AUTHENTICATION_REQUIRED",
      });
      return;
    }

    // For routes with userId parameter, verify ownership
    if (requestedUserId && requestedUserId !== authenticatedUserId) {
      logger.warn({
        requestId: req.requestId,
        userId: authenticatedUserId,
        action: "AuthorizationMiddleware",
        reason: "Unauthorized resource access",
        attemptedResource: "[REDACTED]",
      });

      res.status(403).json({
        success: false,
        message: "Forbidden: Cannot access other users' resources",
        code: "FORBIDDEN",
      });
      return;
    }

    next();
  };
}
