/**
 * AI API client for AI generation operations.
 * Provides typed methods for AI-assisted bundle generation.
 */

import type { UiAIResponse } from '../types';
import { fetchJson } from './fetchUtils';

export interface AiGenerateResponse {
    response: UiAIResponse;
}

/**
 * AI API client with typed methods.
 */
export const aiApi = {
    /**
     * Generate bundle content using AI.
     */
    async generate(bundleDir: string, instructions?: string): Promise<AiGenerateResponse> {
        return fetchJson<AiGenerateResponse>('/ai/generate', {
            method: 'POST',
            body: JSON.stringify({ bundleDir, instructions }),
        });
    },

    /**
     * Fix errors in a bundle using AI.
     */
    async fixErrors(bundleDir: string, instructions?: string): Promise<AiGenerateResponse> {
        return fetchJson<AiGenerateResponse>('/ai/fix-errors', {
            method: 'POST',
            body: JSON.stringify({ bundleDir, instructions }),
        });
    },
};
