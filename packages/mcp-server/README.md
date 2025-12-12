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
| `list_bundles` | List all loaded bundles with their metadata |
| `read_entity` | Read a specific entity by bundle, type and ID |
| `list_entities` | List all entity IDs (filter by bundle/type) |
| `get_context` | Graph traversal to get entity with dependencies |
| `get_conformance_context` | Get profile conformance rules and audit templates |
| `search_entities` | Search for entities across all bundles |

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
│   ├── index.ts       # Entry point, argument parsing
│   ├── server.ts      # MCP server with multi-bundle support
│   └── types.ts       # TypeScript types and Zod schemas
├── scripts/
│   ├── verify-context.ts      # Test script for get_context
│   └── verify-conformance.ts  # Test script for get_conformance_context
├── bundles.example.yaml       # Example config file
└── dist/                      # Compiled output (after build)
```

The server uses:
- `@modelcontextprotocol/sdk` for MCP protocol handling
- `@sdd-bundle-editor/core-model` for bundle loading and validation
- `zod` for input validation
- `js-yaml` for config file parsing
