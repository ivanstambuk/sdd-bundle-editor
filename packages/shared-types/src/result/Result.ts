/**
 * Result type for explicit error handling without exceptions.
 * Follows the "Railway Oriented Programming" pattern.
 */

/**
 * Success result containing a value.
 */
export interface Success<T> {
    readonly success: true;
    readonly value: T;
}

/**
 * Failure result containing an error.
 */
export interface Failure<E> {
    readonly success: false;
    readonly error: E;
}

/**
 * Result type that is either a Success or Failure.
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

// ============================================================================
// Constructors
// ============================================================================

/**
 * Create a success result.
 */
export function ok<T>(value: T): Success<T> {
    return { success: true, value };
}

/**
 * Create a failure result.
 */
export function err<E>(error: E): Failure<E> {
    return { success: false, error };
}

// ============================================================================
// Type guards
// ============================================================================

/**
 * Check if a result is successful.
 */
export function isOk<T, E>(result: Result<T, E>): result is Success<T> {
    return result.success === true;
}

/**
 * Check if a result is a failure.
 */
export function isErr<T, E>(result: Result<T, E>): result is Failure<E> {
    return result.success === false;
}

// ============================================================================
// Combinators
// ============================================================================

/**
 * Map over a successful result.
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
    if (isOk(result)) {
        return ok(fn(result.value));
    }
    return result;
}

/**
 * Map over a failed result.
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    if (isErr(result)) {
        return err(fn(result.error));
    }
    return result;
}

/**
 * Chain results (flatMap).
 */
export function flatMap<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
): Result<U, E> {
    if (isOk(result)) {
        return fn(result.value);
    }
    return result;
}

/**
 * Get the value or a default.
 */
export function getOrDefault<T, E>(result: Result<T, E>, defaultValue: T): T {
    if (isOk(result)) {
        return result.value;
    }
    return defaultValue;
}

/**
 * Get the value or throw an error.
 */
export function getOrThrow<T, E>(result: Result<T, E>): T {
    if (isOk(result)) {
        return result.value;
    }
    if (result.error instanceof Error) {
        throw result.error;
    }
    throw new Error(String(result.error));
}

/**
 * Wrap a function that might throw into a Result-returning function.
 */
export function tryCatch<T>(fn: () => T): Result<T, Error> {
    try {
        return ok(fn());
    } catch (error) {
        return err(error instanceof Error ? error : new Error(String(error)));
    }
}

/**
 * Wrap an async function that might throw into a Result-returning function.
 */
export async function tryCatchAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
    try {
        return ok(await fn());
    } catch (error) {
        return err(error instanceof Error ? error : new Error(String(error)));
    }
}
