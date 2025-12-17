# SDD Bundle MCP Server

Model Context Protocol (MCP) server that exposes SDD bundle data to AI agents. This allows AI assistants like GitHub Copilot, Claude Desktop, or any MCP-compatible client to read and understand your specification bundles.

## Features

### Multi-Bundle Support

The server supports loading **multiple bundles simultaneously**, allowing you to:
- Query across different specification bundles
- Combine related specs (API, security, observability, etc.)
- Search entities across all loaded bundles

### Resources
- **`bundles`** - List all loaded bundles with metadata
- **`domain-knowledge`** - Aggregated domain knowledge from all bundles

### Tools

| Tool | Description |
|------|-------------|
| `list_bundles` | List all loaded bundles with metadata and entity counts |
| `get_bundle_schema` | Get the bundle type definition (metaschema) for a bundle |
| `get_entity_schema` | Get the JSON schema for a specific entity type |
| `get_bundle_snapshot` | Get complete bundle with entities, schemas, refGraph (supports filtering) |
| `read_entity` | Read a specific entity by bundle, type and ID |
| `read_entities` | Bulk read multiple entities by ID (more efficient than multiple read_entity calls) |
| `list_entities` | List all entity IDs (filter by bundle/type, with stable ordering) |
| `list_entity_summaries` | List entities with summary fields (id, title, state) |
| `get_entity_relations` | Get relationships defined for an entity type |
| `get_context` | Graph traversal to get entity with dependencies |
| `get_conformance_context` | Get profile conformance rules and audit templates |
| `search_entities` | Search for entities across all bundles |
| `validate_bundle` | Validate a bundle and return diagnostics |
| `apply_changes` | Atomic batch changes (create/update/delete) with schema validation |
| `critique_bundle` | LLM-based quality critique via MCP sampling (requires client sampling support) |


#### Response Envelope

All tools return a standardized response envelope:

```json
{
  "ok": true,
  "tool": "read_entity",
  "bundleId": "my-bundle",
  "data": { ... },
  "meta": { ... },
  "diagnostics": []
}
```

For errors:

```json
{
  "ok": false,
  "tool": "read_entity",
  "error": {
    "code": "NOT_FOUND",
    "message": "Entity not found: Requirement/REQ-999",
    "details": { "entityType": "Requirement", "entityId": "REQ-999" }
  }
}
```

**Error Codes:** `BAD_REQUEST`, `NOT_FOUND`, `VALIDATION_ERROR`, `REFERENCE_ERROR`, `DELETE_BLOCKED`, `INTERNAL`

### Prompts (Structured AI Workflows)
| Prompt | Description |
|--------|-------------|
| `implement-requirement` | Generate an implementation plan for a requirement |
| `explain-entity` | Get a clear explanation of any entity for different audiences |
| `audit-profile` | Perform a conformance audit against a profile |
| `trace-dependency` | Trace upstream/downstream dependencies for any entity |
| `coverage-analysis` | Analyze coverage gaps in specifications |
| `suggest-relations` | Suggest missing relationships between entities |
| `generate-test-cases` | Generate test cases for requirements or features |
| `summarize-bundle` | Generate executive/technical summaries of a bundle |
| `diff-bundles` | Compare two bundles and highlight differences |
| `create-roadmap` | Generate implementation roadmap from specifications |
| `bundle-health` | Analyze bundle health and generate a report |

---

## Tool Reference

### apply_changes

Atomic batch changes with schema validation, reference integrity, and safety defaults.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bundleId` | string | - | Bundle ID (optional in single-bundle mode) |
| `changes` | object[] | required | Array of operations |
| `dryRun` | boolean | `true` | Preview without writing (safety default) |
| `validate` | `strict`/`warn`/`none` | `strict` | Schema validation mode |
| `referencePolicy` | `strict`/`warn`/`none` | `strict` | Reference integrity checking |
| `deleteMode` | `restrict`/`orphan` | `restrict` | Block deletion if referenced |

**Change Operations:**

```json
{
  "changes": [
    { "operation": "create", "entityType": "Requirement", "entityId": "REQ-NEW", "data": { "title": "New Req" } },
    { "operation": "update", "entityType": "Requirement", "entityId": "REQ-001", "fieldPath": "priority", "value": "high" },
    { "operation": "delete", "entityType": "Requirement", "entityId": "REQ-OLD" }
  ],
  "dryRun": false
}
```

**Validation Behavior:**

- `strict`: Rejects invalid entities, unknown fields, broken references
- `warn`: Returns diagnostics but allows operation
- `none`: Skips validation (not recommended)

### get_bundle_snapshot

Get a complete bundle snapshot optimized for initial loads.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bundleId` | string | - | Bundle ID |
| `entityTypes` | string[] | all | Filter to specific types |
| `includeEntityData` | `full`/`summary`/`ids` | `full` | Entity data detail level |
| `includeSchemas` | boolean | `true` | Include JSON schemas |
| `includeRefGraph` | boolean | `true` | Include reference graph |
| `includeDiagnostics` | boolean | `true` | Include validation diagnostics |
| `maxEntities` | number | 5000 | Truncation limit (max 10000) |

**Example (lightweight snapshot):**

```json
{
  "entityTypes": ["Requirement", "Task"],
  "includeEntityData": "summary",
  "includeSchemas": false,
  "maxEntities": 100
}
```

**Meta Response:**

```json
{
  "meta": {
    "entityCount": 100,
    "totalEntities": 500,
    "truncated": true,
    "entityTypes": ["Requirement", "Task"],
    "allEntityTypes": ["Requirement", "Task", "Feature", "Component"]
  }
}
```

### get_bundle_schema

Get the bundle type definition (metaschema) to understand entity relationships and bundle structure.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bundleId` | string | - | Bundle ID (optional in single-bundle mode) |

**Response:**

```json
{
  "manifest": {
    "name": "My Specification",
    "bundleType": "sdd-spec",
    "version": "1.0.0"
  },
  "bundleTypeDefinition": {
    "entities": { "Requirement": {...}, "Feature": {...} },
    "relations": [
      { "name": "realizes", "fromEntity": "Requirement", "fromField": "realizesFeatureIds", "toEntity": "Feature" }
    ]
  }
}
```

### get_entity_schema

Get the JSON schema for a specific entity type. Useful for form rendering or understanding entity structure.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bundleId` | string | - | Bundle ID (optional in single-bundle mode) |
| `entityType` | string | required | Entity type (e.g., 'Requirement', 'Task') |

**Response:**

```json
{
  "entityType": "Requirement",
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "properties": {
      "id": { "type": "string", "pattern": "^REQ-" },
      "title": { "type": "string", "maxLength": 100 },
      "priority": { "type": "string", "enum": ["critical", "high", "medium", "low"] }
    },
    "required": ["id", "title"]
  }
}
```

### read_entity

Read complete data for a single entity.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bundleId` | string | - | Bundle ID (optional in single-bundle mode) |
| `entityType` | string | required | Entity type |
| `id` | string | required | Entity ID |

### read_entities

Bulk read multiple entities in a single call (more efficient than multiple read_entity calls).

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bundleId` | string | - | Bundle ID (optional in single-bundle mode) |
| `entityType` | string | required | Entity type |
| `ids` | string[] | required | Entity IDs to fetch (max 50) |
| `fields` | string[] | all | Specific fields to return |

**Response includes `meta.notFound`** listing any IDs that weren't found.

### list_entities

List entity IDs with pagination support.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bundleId` | string | - | Bundle ID (or 'all' for all bundles) |
| `entityType` | string | - | Filter by entity type |
| `limit` | number | 100 | Max IDs to return (max 500) |
| `offset` | number | 0 | Pagination offset |

**Meta Response:** Includes `total`, `hasMore`, `returned` for pagination.

### list_entity_summaries

List entities with summary fields (id, title, state) - better for selection UIs.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bundleId` | string | - | Bundle ID (optional in single-bundle mode) |
| `entityType` | string | - | Filter by entity type |
| `include` | string[] | `["id", "title"]` | Fields to include in summaries |
| `limit` | number | 50 | Max results (max 200) |
| `offset` | number | 0 | Pagination offset |

### get_entity_relations

Get relationship definitions for an entity type from the bundle-type specification.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bundleId` | string | - | Bundle ID (optional in single-bundle mode) |
| `entityType` | string | - | Filter by entity type (shows all if not specified) |
| `direction` | `outgoing`/`incoming`/`both` | `both` | Filter by relationship direction |

**Response:**

```json
{
  "relations": [
    {
      "name": "realizes",
      "fromEntity": "Requirement",
      "fromField": "realizesFeatureIds",
      "toEntity": "Feature",
      "direction": "outgoing"
    }
  ]
}
```

### get_context

Graph traversal to get an entity with its related dependencies.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bundleId` | string | - | Bundle ID (optional in single-bundle mode) |
| `entityType` | string | required | Entity type |
| `id` | string | required | Entity ID |
| `depth` | number | 1 | Traversal depth (max 3) |
| `maxRelated` | number | 20 | Max related entities (max 100) |
| `includeRelated` | `full`/`summary`/`ids` | `full` | Detail level for related entities |
| `fields` | string[] | all | Fields to return for target entity |

**Response:**

```json
{
  "target": { "id": "REQ-001", "title": "..." },
  "related": [
    { "id": "FEAT-001", "entityType": "Feature", "relation": "references", "field": "realizesFeatureIds", "data": {...} }
  ],
  "meta": { "relatedCount": 5, "maxRelated": 20, "truncated": false }
}
```

### get_conformance_context

Get conformance rules and audit templates from a Profile.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bundleId` | string | - | Bundle ID (optional in single-bundle mode) |
| `profileId` | string | - | Profile ID (lists all profiles if not specified) |

**Without profileId (list mode):**

```json
{
  "profiles": [
    { "id": "PROF-SECURITY", "title": "Security Baseline", "description": "..." }
  ],
  "meta": { "count": 2 }
}
```

**With profileId:**

```json
{
  "profile": { "id": "PROF-SECURITY", "title": "Security Baseline" },
  "rules": [
    { "ruleId": "SEC-001", "description": "...", "linkedRequirement": "REQ-001", "requirementText": "..." }
  ],
  "auditTemplate": { "sections": [...] },
  "requiredFeatures": [...],
  "meta": { "ruleCount": 5 }
}
```

### search_entities

Search for entities across all bundles by keyword.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search query (searches IDs, titles, descriptions) |
| `entityType` | string | - | Filter by entity type |
| `bundleId` | string | - | Filter by bundle ID |
| `limit` | number | 50 | Max results (max 100) |
| `offset` | number | 0 | Pagination offset |

**Response:**

```json
{
  "results": [
    { "bundleId": "my-bundle", "entityType": "Requirement", "id": "REQ-001", "title": "...", "match": "title" }
  ],
  "meta": { "total": 15, "hasMore": true }
}
```

### validate_bundle

Validate a bundle and return all diagnostics (errors, warnings).

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bundleId` | string | - | Bundle ID (or 'all' to validate all bundles) |

**Response:**

```json
{
  "summary": {
    "totalErrors": 2,
    "totalWarnings": 5,
    "isValid": false
  },
  "diagnostics": [
    { "severity": "error", "code": "BROKEN_REFERENCE", "message": "...", "entityType": "Requirement", "entityId": "REQ-001" }
  ]
}
```

### critique_bundle

Trigger an LLM-based quality critique of the bundle using MCP sampling. The server sends a prompt to the client's LLM requesting an evaluation of the spec for AI consumability and completeness.

**Requires:** Client must support MCP sampling capability (Claude Desktop supports this).

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `bundleId` | string | - | Bundle ID (optional in single-bundle mode) |
| `threshold` | number | 5 | Minimum score (1-10) to include in findings. Higher = stricter. |

**Response (Success):**

```json
{
  "ok": true,
  "data": {
    "verdict": "NEEDS_WORK",
    "overallScore": 6,
    "threshold": 5,
    "findings": [
      {
        "score": 8,
        "category": "completeness",
        "entityId": "REQ-AUTH-001",
        "issue": "Requirement has no acceptance criteria",
        "suggestion": "Add 'acceptanceCriteria' field with testable conditions"
      }
    ],
    "totalFindings": 5,
    "filteredOut": 2
  },
  "meta": {
    "samplingUsed": true,
    "model": "claude-3-sonnet"
  }
}
```

**Verdict Values:**
- `APPROVED` - Spec meets quality standards
- `NEEDS_WORK` - Issues found that should be addressed
- `REJECTED` - Critical flaws that block usage

**Categories:**
- `completeness` - Missing required fields (rationale, acceptance criteria)
- `clarity` - Vague or ambiguous language
- `connectivity` - Orphan entities, missing relationships
- `consistency` - Inconsistent terminology
- `consumability` - Poor structure for AI consumption

**Error (Sampling Not Supported):**

```json
{
  "ok": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "MCP sampling is not supported by this client.",
    "details": {
      "hint": "Use Claude Desktop or another MCP client that supports sampling."
    }
  }
}
```

---


## Running Locally

### Prerequisites

1. Build the MCP server:
   ```bash
   cd /home/ivan/dev/sdd-bundle-editor
   pnpm build
   ```

2. Ensure you have SDD bundle(s) available

### Running Modes

#### Mode 1: Single Bundle (Default)

```bash
# With explicit path
node packages/mcp-server/dist/index.js /path/to/your/bundle

# With environment variable
SDD_SAMPLE_BUNDLE_PATH=/path/to/bundle node packages/mcp-server/dist/index.js

# Using default path (/home/ivan/dev/sdd-sample-bundle)
node packages/mcp-server/dist/index.js
```

#### Mode 2: Multiple Bundles (Command Line)

```bash
node packages/mcp-server/dist/index.js /bundle1 /bundle2 /bundle3
```

Each bundle gets an auto-generated ID from its directory name.

#### Mode 3: Config File (Recommended for Multiple Bundles)

```bash
node packages/mcp-server/dist/index.js --config /path/to/bundles.yaml
```

**bundles.yaml format:**

```yaml
bundles:
  - id: api-spec
    path: /home/ivan/specs/api-specification
    tags: [api, rest]
    description: "Company REST API specification"

  - id: security
    path: /home/ivan/specs/security-standards
    tags: [security, compliance]
    description: "Security baseline requirements"

  - id: observability
    path: /home/ivan/specs/otel-schema
    tags: [telemetry]
    description: "OpenTelemetry conventions"
```

See `bundles.example.yaml` for a complete example.

#### Mode 4: HTTP/SSE Transport (For Web Clients)

The server can also run in HTTP mode using the MCP Streamable HTTP transport. This is useful for:
- Web UI integration without a stdio bridge
- Testing MCP tools via curl
- Browser-based MCP clients

```bash
# Start HTTP server on default port (3001)
node packages/mcp-server/dist/index.js --http /path/to/bundle

# Custom port
node packages/mcp-server/dist/index.js --http --port 3002 /path/to/bundle

# With config file
node packages/mcp-server/dist/index.js --http --config bundles.yaml
```

**HTTP Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/sessions` | GET | List active sessions |
| `/mcp` | POST | MCP protocol endpoint (initialize, tool calls) |
| `/mcp` | GET | SSE stream for server notifications |
| `/mcp` | DELETE | Session termination |

**Example Session:**

```bash
# 1. Initialize session
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{
    "protocolVersion":"2024-11-05",
    "capabilities":{},
    "clientInfo":{"name":"curl","version":"1.0"}
  }}'

# Response includes Mcp-Session-Id header

# 2. Call a tool with the session ID
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: <session-id-from-step-1>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
    "name":"list_bundles",
    "arguments":{}
  }}'
```

**Environment Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_HTTP_PORT` | HTTP server port | 3001 |
| `SDD_SAMPLE_BUNDLE_PATH` | Default bundle path | /home/ivan/dev/sdd-sample-bundle |

#### MCP Test CLI

A command-line tool for testing MCP tools via HTTP transport:

```bash
# First, start the server in HTTP mode
pnpm start:http

# Then use the CLI in another terminal
cd packages/mcp-server

# Check health
pnpm mcp-cli health

# List bundles
pnpm mcp-cli list_bundles

# Read an entity
pnpm mcp-cli read_entity -t Requirement -i REQ-001

# Search entities
pnpm mcp-cli search_entities -q "authentication"

# Validate bundle
pnpm mcp-cli validate_bundle

# Apply changes (dry-run)
pnpm mcp-cli apply_changes --dry-run -c '[{"operation":"update","bundleId":"my-bundle","entityType":"Requirement","entityId":"REQ-001","data":{"title":"Updated"}}]'

# Output as JSON
pnpm mcp-cli list_bundles --json
```

---

## Using with Multiple Bundles

When multiple bundles are loaded, most tools require a `bundleId` parameter:

```json
{
  "bundleId": "api-spec",
  "entityType": "Requirement",
  "id": "REQ-001"
}
```

### Special Cases

- **`list_entities` with `bundleId: "all"`** - Lists entities from all bundles
- **`search_entities`** - Searches across all bundles by default
- **`list_bundles`** - Shows all loaded bundles (no bundleId needed)

### Example: Cross-Bundle Workflow

```
1. #list_bundles
   → See all available bundles: api-spec, security, observability

2. #search_entities query="authentication"
   → Find auth-related entities across all bundles

3. #get_context bundleId="api-spec" entityType="Requirement" id="AUTH-001"
   → Get full context for a specific requirement

4. #read_entity bundleId="security" entityType="Threat" id="THREAT-AUTHZ"
   → Read related security threat from another bundle
```

---

## Testing with MCP Inspector

```bash
# Single bundle
npx @modelcontextprotocol/inspector node packages/mcp-server/dist/index.js /path/to/bundle

# Multiple bundles
npx @modelcontextprotocol/inspector node packages/mcp-server/dist/index.js /bundle1 /bundle2

# Config file
npx @modelcontextprotocol/inspector node packages/mcp-server/dist/index.js --config bundles.yaml
```

### Using the Inspector

1. **Resources Tab**: 
   - Click `bundles` to see all loaded bundles
   - Click `domain-knowledge` to see aggregated domain docs

2. **Tools Tab**:
   - `list_bundles` - See what's loaded
   - `search_entities` - Search across all bundles
   - Other tools - Specify `bundleId` when in multi-bundle mode

3. **Prompts Tab**:
   - `implement-requirement` - Get an implementation plan
   - `explain-entity` - Understand any entity
   - `audit-profile` - Run conformance checks
   - `trace-dependency` - Analyze entity dependencies

---

## Using Prompts

Prompts provide structured AI workflows. They gather relevant context and format it for the AI.

### implement-requirement

Generate an implementation plan for a requirement:

```json
{
  "requirementId": "REQ-AUTH-001",
  "depth": "detailed"
}
```

**depth options**: `overview`, `detailed`, `with-code`

### explain-entity

Get a clear explanation of any entity:

```json
{
  "entityType": "Component",
  "entityId": "COMP-API-GATEWAY",
  "audience": "new-team-member"
}
```

**audience options**: `developer`, `stakeholder`, `new-team-member`

### audit-profile

Perform a conformance audit:

```json
{
  "profileId": "PROF-SECURITY-BASELINE",
  "scope": "full"
}
```

**scope options**: `full`, `requirements-only`, `quick`

### trace-dependency

Analyze dependencies for any entity:

```json
{
  "entityType": "Task",
  "entityId": "TASK-001",
  "direction": "both"
}
```

**direction options**: `upstream`, `downstream`, `both`

### coverage-analysis

Analyze coverage gaps in your specification:

```json
{
  "focus": "all",
  "threshold": 80
}
```

**focus options**: `requirements`, `features`, `threats`, `all`

### suggest-relations

Get AI suggestions for missing relationships:

```json
{
  "entityType": "Requirement",
  "confidence": "high"
}
```

**confidence options**: `high`, `medium`, `all`

### generate-test-cases

Generate test cases for a requirement or feature:

```json
{
  "entityType": "Requirement",
  "entityId": "REQ-001",
  "style": "bdd"
}
```

**style options**: `bdd`, `traditional`, `checklist`

### summarize-bundle

Generate a summary of the bundle:

```json
{
  "format": "executive"
}
```

**format options**: `executive`, `technical`, `onboarding`

### diff-bundles

Compare two loaded bundles (requires multi-bundle mode):

```json
{
  "bundleA": "api-v1",
  "bundleB": "api-v2",
  "focus": "all"
}
```

**focus options**: `all`, `requirements`, `structure`

### create-roadmap

Generate an implementation roadmap:

```json
{
  "scope": "all",
  "format": "phases"
}
```

**format options**: `timeline`, `phases`, `milestones`

---

## VS Code + GitHub Copilot Integration

### Single Bundle Configuration

Create `.vscode/mcp.json`:

```json
{
  "servers": {
    "sdd-bundle": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/home/ivan/dev/sdd-bundle-editor/packages/mcp-server/dist/index.js",
        "/path/to/your/bundle"
      ]
    }
  }
}
```

### Multi-Bundle Configuration

```json
{
  "servers": {
    "sdd-specs": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/home/ivan/dev/sdd-bundle-editor/packages/mcp-server/dist/index.js",
        "--config",
        "/home/ivan/specs/bundles.yaml"
      ]
    }
  }
}
```

### Using the Tools

**In Copilot Chat (Agent Mode):**

```
#list_bundles What bundles are available?

#search_entities Find all authentication requirements

#get_context bundleId="api-spec" entityType="Requirement" id="REQ-001"
```

---

## Claude Desktop Integration

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sdd-specs": {
      "command": "node",
      "args": [
        "/home/ivan/dev/sdd-bundle-editor/packages/mcp-server/dist/index.js",
        "--config",
        "/home/ivan/specs/bundles.yaml"
      ]
    }
  }
}
```

---

## Architecture

```
packages/mcp-server/
├── src/
│   ├── index.ts          # Entry point, argument parsing
│   ├── server.ts         # MCP server with multi-bundle support
│   ├── http-transport.ts # HTTP/SSE transport for web clients
│   └── types.ts          # TypeScript types and Zod schemas
├── scripts/
│   ├── verify-context.ts      # Test script for get_context
│   └── verify-conformance.ts  # Test script for get_conformance_context
├── bundles.example.yaml       # Example config file
└── dist/                      # Compiled output (after build)
```

The server uses:
- `@modelcontextprotocol/sdk` for MCP protocol handling
- `@sdd-bundle-editor/core-model` for bundle loading and validation
- `express` for HTTP server (HTTP mode)
- `zod` for input validation
- `js-yaml` for config file parsing

