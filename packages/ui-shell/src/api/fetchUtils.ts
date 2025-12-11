/**
 * Fetch utilities for API communication.
 * Extracted from AppShell for reusability and testability.
 */

import { createLogger } from '../utils/logger';

const log = createLogger('fetchUtils');

/**
 * Fetch JSON from an API endpoint with default headers.
 * Throws an error with response text on non-OK status.
 */
export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
    }
    return (await res.json()) as T;
}

/**
 * Retry wrapper with exponential backoff for transient failures.
 * Only retries on network errors or 5xx responses.
 */
export async function fetchWithRetry<T>(
    url: string,
    options?: RequestInit,
    maxRetries = 3
): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fetchJson<T>(url, options);
        } catch (err) {
            lastError = err as Error;
            // Only retry on network errors or 5xx, not on 4xx client errors
            const isRetryable = lastError.message.includes('fetch') ||
                lastError.message.includes('5') ||
                lastError.message.includes('network');
            if (!isRetryable || attempt === maxRetries - 1) {
                throw lastError;
            }
            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempt) * 1000;
            log.debug(`Retrying request (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
