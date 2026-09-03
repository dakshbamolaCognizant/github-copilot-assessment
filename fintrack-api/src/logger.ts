/**
 * Logger Interface and Implementation
 *
 * Provides structured logging for the application.
 * Supports different log levels and context propagation.
 *
 * @module logger
 */

/**
 * Structured log context
 */
export interface LogContext {
  requestId?: string;
  userId?: string;
  action?: string;
  [key: string]: any;
}

/**
 * Logger interface for dependency injection
 */
export interface Logger {
  /**
   * Log info level message
   */
  info(context: LogContext): void;

  /**
   * Log warning level message
   */
  warn(context: LogContext): void;

  /**
   * Log error level message
   */
  error(context: LogContext): void;

  /**
   * Log debug level message
   */
  debug(context: LogContext): void;
}

/**
 * Default logger implementation using console
 */
export class ConsoleLogger implements Logger {
  info(context: LogContext): void {
    console.log(`[INFO]`, JSON.stringify(context));
  }

  warn(context: LogContext): void {
    console.warn(`[WARN]`, JSON.stringify(context));
  }

  error(context: LogContext): void {
    console.error(`[ERROR]`, JSON.stringify(context));
  }

  debug(context: LogContext): void {
    console.debug(`[DEBUG]`, JSON.stringify(context));
  }
}

/**
 * No-op logger for testing
 */
export class NoOpLogger implements Logger {
  info(): void {}
  warn(): void {}
  error(): void {}
  debug(): void {}
}
