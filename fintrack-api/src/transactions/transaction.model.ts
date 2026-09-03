/**
 * @deprecated Use transaction.repository.ts instead
 *
 * This file is maintained for backward compatibility only.
 * All new code should import from transaction.repository.ts
 *
 * @example
 * // ❌ Old way
 * import { TransactionRepository } from './transaction.model';
 *
 * // ✅ New way
 * import { TransactionRepository } from './transaction.repository';
 */

export { TransactionRepository, type ITransactionRepository } from "./transaction.repository";
export type { CreateTransactionInput } from "./transaction.dto";