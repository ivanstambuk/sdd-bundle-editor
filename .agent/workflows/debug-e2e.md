---
description: How to debug E2E tests with verbose logging and output capture
---

# Debugging Playwright E2E Tests

When debugging E2E tests, it's crucial to see both the Playwright runner output and the browser/server logs. We use a combination of output redirection and console listeners.

## 1. Running with Output Capture

The most reliable way to capture all logs (including server logs piped to stdout) is to redirect the output to a file.

\```bash
pnpm test:e2e e2e/agent-editing.spec.ts > debug_output.txt 2>&1
\```

After running this found, inspect `debug_output.txt`. It will contain:
- Playwright test results
- Server request/response logs (piped from the test server)
- Browser console logs (captured by the test listener)

## 2. Enabling Verbose Browser Logging in Tests

Ensure your test file (`*.spec.ts`) has the console listener enabled:

\```typescript
test('should do something', async ({ page }) => {
    // Pipe browser console to node console
    page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
    
    // ... rest of test
});
\```

## 3. Investigating Server Errors

The server logs detailed errors (like 400 Bad Request with "sdd-bundle.yaml not found"). Search for "level":50 or "err" in the captured output file.

## Common Pitfalls

- **Missing `bundleDir`**: Ensure all API calls to `/agent/*` endpoints include `?bundleDir=...` or pass it in the body. The server now enforcing this prevents silent failures.
- **Fixture IDs**: E2E tests run against temporary copies of bundles. Use `list_dir` or known constants to reference Entity IDs; do not assume IDs from the `examples` folder unless you verified them.
