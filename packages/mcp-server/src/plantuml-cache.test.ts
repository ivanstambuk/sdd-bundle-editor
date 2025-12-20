import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import crypto from 'node:crypto';

/**
 * PlantUML HTTP Caching Tests
 * 
 * Tests the /api/plantuml/:hash endpoint for proper HTTP caching behavior:
 * - Cache-Control headers
 * - ETag headers
 * - 304 Not Modified responses
 * - Hash validation
 */

// Mock the PlantUML rendering to avoid requiring plantuml CLI in tests
const mockSvg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Mock Diagram</text></svg>';

// Create a minimal test server with just the PlantUML endpoints
function createTestServer() {
    const app = express();
    app.use(express.json());

    // Hash-based cache
    const diagramCache = new Map<string, string>();

    function computeDiagramHash(code: string, theme?: 'light' | 'dark'): string {
        const content = `${theme || 'default'}:${code.trim()}`;
        return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    }

    // GET /api/plantuml/:hash - Cached endpoint
    app.get('/api/plantuml/:hash', (req, res) => {
        const { hash } = req.params;
        const { code, theme } = req.query as { code?: string; theme?: 'light' | 'dark' };

        // Check If-None-Match header for conditional requests
        const ifNoneMatch = req.headers['if-none-match'];
        if (ifNoneMatch === `"${hash}"` || ifNoneMatch === hash) {
            res.status(304).end();
            return;
        }

        // Check server cache first
        const cached = diagramCache.get(hash);
        if (cached) {
            res
                .set('Content-Type', 'image/svg+xml')
                .set('ETag', `"${hash}"`)
                .set('Cache-Control', 'public, max-age=31536000, immutable')
                .send(cached);
            return;
        }

        // Not in cache - need code to render
        if (!code || typeof code !== 'string' || !code.trim()) {
            res.status(400).json({ error: 'PlantUML code required for uncached diagram' });
            return;
        }

        // Verify hash matches the code
        const computedHash = computeDiagramHash(code, theme);
        if (computedHash !== hash) {
            res.status(400).json({ error: 'Hash mismatch - code does not match hash' });
            return;
        }

        // "Render" the diagram (mock)
        const svg = mockSvg;

        // Cache the result
        diagramCache.set(hash, svg);

        res
            .set('Content-Type', 'image/svg+xml')
            .set('ETag', `"${hash}"`)
            .set('Cache-Control', 'public, max-age=31536000, immutable')
            .send(svg);
    });

    return app;
}

describe('PlantUML HTTP Caching', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
        const app = createTestServer();
        await new Promise<void>((resolve) => {
            server = app.listen(0, () => {
                const address = server.address();
                const port = typeof address === 'object' ? address?.port : 0;
                baseUrl = `http://localhost:${port}`;
                resolve();
            });
        });
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
    });

    function computeHash(code: string, theme?: 'light' | 'dark'): string {
        const content = `${theme || 'default'}:${code.trim()}`;
        return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
    }

    it('returns SVG with correct Content-Type', async () => {
        const code = '@startuml\nAlice -> Bob: Hello\n@enduml';
        const hash = computeHash(code, 'light');

        const response = await fetch(`${baseUrl}/api/plantuml/${hash}?code=${encodeURIComponent(code)}&theme=light`);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('image/svg+xml');

        const body = await response.text();
        expect(body).toContain('<svg');
    });

    it('returns Cache-Control: immutable header', async () => {
        const code = '@startuml\nBob -> Alice: Hi\n@enduml';
        const hash = computeHash(code, 'dark');

        const response = await fetch(`${baseUrl}/api/plantuml/${hash}?code=${encodeURIComponent(code)}&theme=dark`);

        expect(response.status).toBe(200);
        expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    });

    it('returns ETag header matching content hash', async () => {
        const code = '@startuml\nCharlie -> Dave: Test\n@enduml';
        const hash = computeHash(code);

        const response = await fetch(`${baseUrl}/api/plantuml/${hash}?code=${encodeURIComponent(code)}`);

        expect(response.status).toBe(200);
        expect(response.headers.get('etag')).toBe(`"${hash}"`);
    });

    it('returns 304 Not Modified when If-None-Match matches hash', async () => {
        const code = '@startuml\nEve -> Frank: Cached\n@enduml';
        const hash = computeHash(code);

        // First request - populate cache
        await fetch(`${baseUrl}/api/plantuml/${hash}?code=${encodeURIComponent(code)}`);

        // Second request with If-None-Match
        const response = await fetch(`${baseUrl}/api/plantuml/${hash}?code=${encodeURIComponent(code)}`, {
            headers: { 'If-None-Match': `"${hash}"` },
        });

        expect(response.status).toBe(304);
    });

    it('returns 400 for hash mismatch (code does not match hash)', async () => {
        const code = '@startuml\nGrace -> Heidi: Original\n@enduml';
        const wrongHash = 'deadbeef12345678'; // Intentionally wrong hash

        const response = await fetch(`${baseUrl}/api/plantuml/${wrongHash}?code=${encodeURIComponent(code)}`);

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('Hash mismatch');
    });

    it('returns 400 when code is missing for uncached diagram', async () => {
        const hash = 'newdiagram123456';

        const response = await fetch(`${baseUrl}/api/plantuml/${hash}`);

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('code required');
    });

    it('serves from cache on second request (no code needed)', async () => {
        const code = '@startuml\nIvan -> Julia: Cache me\n@enduml';
        const hash = computeHash(code, 'light');

        // First request with code
        const response1 = await fetch(`${baseUrl}/api/plantuml/${hash}?code=${encodeURIComponent(code)}&theme=light`);
        expect(response1.status).toBe(200);

        // Second request WITHOUT code - should serve from cache
        const response2 = await fetch(`${baseUrl}/api/plantuml/${hash}`);
        expect(response2.status).toBe(200);
        expect(response2.headers.get('etag')).toBe(`"${hash}"`);
    });
});
