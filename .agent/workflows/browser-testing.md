---
description: AI-driven browser testing for design review and exploratory testing
---

# Browser Testing Workflow

This workflow enables AI agents to perform visual design review and exploratory testing using the browser_subagent tool.

## Prerequisites

// turbo
1. Check if servers are already running:
   ```bash
   curl -s http://localhost:3000/health && curl -s http://localhost:5173 > /dev/null && echo "Servers ready"
   ```

2. If servers are NOT running, start them with a single command:
   ```bash
   cd /home/ivan/dev/sdd-bundle-editor && pnpm dev
   ```
   
   This runs both backend and web concurrently. Output is prefixed with `[server]` and `[web]`.

## Browser Testing Tasks

### Design Review
Use browser_subagent to:
- Navigate to http://localhost:5173
- Take screenshots of the main UI layout
- Verify visual elements render correctly

### Entity Navigation Test
Use browser_subagent to:
- Navigate to http://localhost:5173
- Click on entities in the left panel
- Verify the entity details panel updates
- Take screenshots of different entity views

### Compile Spec Flow Test
Use browser_subagent to:
- Navigate to http://localhost:5173
- Click "Compile Spec" button
- Verify diagnostics panel shows results
- Take screenshot of the diagnostics output

## Example browser_subagent Usage

```
Task: Navigate to http://localhost:5173, click on FEAT-001 entity, take a screenshot of the entity details panel, then return.
RecordingName: entity_selection_demo
```

## Automated CI Testing

For automated CI testing, use Playwright instead:
```bash
pnpm test:e2e
```

This will start servers automatically and run the e2e tests.
