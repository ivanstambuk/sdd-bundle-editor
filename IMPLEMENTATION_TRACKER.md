# SDD Bundle Editor – Implementation Tracker

This file tracks active and planned implementation work. For architectural context and completed work, see:
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** – Core concepts, package structure, design decisions
- **[AGENTS.md](./AGENTS.md)** – Developer/agent operational guide

Status legend:
- [ ] not started
- [~] in progress
- [x] done

---

## Completed Phases (0-7) ✅

**Phases 0-7 have been completed**, establishing:

- ✅ **Monorepo structure** with pnpm workspaces and shared tooling
- ✅ **Core packages**: `core-schema` (Ajv/JSON Schema), `core-model` (bundle loading), `core-lint` (validation rules), `core-ai` (provider abstraction)
- ✅ **CLI** with `validate` and `report-coverage` commands
- ✅ **Backend server** (Fastify) with bundle, validation, and AI endpoints
- ✅ **Frontend UI** (React + RJSF) with entity navigation, schema-driven forms, reference links, and diagnostics panel
- ✅ **Modern CSS styling** with dark theme, color-coded entity types, and polished components
- ✅ **Testing**: Vitest unit tests + Playwright e2e tests with working `webServer` configuration
- ✅ **Git utilities** for branch checking and clean working tree verification

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation of the completed implementation.

---

## Spec Compliance & Enhancements [NEW]

Tasks to bring the implementation into full compliance with `sdd-bundle-editor-spec.md`:

### Domain Knowledge Markdown Support
- [x] Add `domainKnowledge.path` to bundle manifest schema *(already in BundleManifest type)*
- [x] Load markdown file in `core-model` bundle loading *(added to loadBundle)*
- [x] Include domain markdown in AI request context
- [x] (Optional) Display domain markdown in UI as read-only panel

### Enhanced sdd-ref Validation
- [x] Parse `x-refTargets` from schema during sdd-ref validation
- [x] Validate that referenced entity type matches allowed targets
- [x] Add diagnostic for type mismatch (code: `ref-type-mismatch`)

### Expanded Example Bundle
- [x] Add full `bundle-type.json` with entities and relations arrays *(already present)*
- [x] Add more entity types: ADR, Profile, Fixture (schema + sample entities)
- [x] Add lint configuration with feature-based rules
- [x] Add sample `domain-knowledge.md` file *(already present)*

### Spec Document Cleanup
- [x] Remove detailed Phases 0-7 from spec (now in ARCHITECTURE.md)
- [x] Update Phase 8 section to reflect agent-first approach
- [x] Mark obsolete "manual editing" sections as superseded
- [x] Ensure spec and implementation are in sync

---

## Phase 8 – Agent-First Editing [ACTIVE]

This phase introduces a fundamental change: **all modifications happen through conversational AI rather than direct editing**. The UI becomes a read-only viewer, and changes are proposed, reviewed, and applied via an agent conversation.

### Core Philosophy

- Users describe intent in natural language; the agent proposes concrete changes
- Through conversation, user and agent agree on modifications
- Only after agreement are files modified, linted, and committed
- The editor serves as a visualization tool, not an editing canvas

### Git Discipline

- Before starting any edit conversation, the repository must be clean
- After successful changes (passing lint), changes are committed automatically
- If linting fails, the conversation continues until issues are resolved or aborted

---

### 8.1 – Conversational Agent Interface

- [x] Design and implement a chat/prompt panel in the UI:
  - [x] Text input for user prompts
  - [x] Conversation history display (user messages, agent responses)
  - [x] "Start conversation" action that validates Git status first
  - [x] Visual indicators for conversation state (idle, awaiting response, changes pending, linting, committed)

- [x] Implement conversation protocol types:
  - [x] `ConversationMessage` (role: user | agent, content, timestamp)
  - [x] `ConversationState` (idle | active | pendingChanges | linting | committed | error)
  - [x] `ProposedChange` (entity, field, oldValue, newValue, rationale)

- [x] Add conversation management to backend:
  - [x] `POST /agent/start` – Initialize conversation (checks Git clean status)
  - [x] `POST /agent/message` – Send user message, get agent response
  - [x] `POST /agent/accept` – Accept proposed changes, apply, lint, commit
  - [x] `POST /agent/abort` – Abort conversation without applying changes
  - [x] `GET /agent/status` – Current conversation state

---

- [x] Define `AgentBackend` abstraction in `core-ai`:
  - [ ] `VsCodeAgentBackend` – Communicates with VS Code's integrated agent
  - [x] `CliAgentBackend` – Spawns CLI agent process (stdin/stdout)
  - [x] `HttpAgentBackend` – Calls external HTTP API (Claude, OpenAI, etc.)
  - [ ] `McpAgentBackend` – Uses MCP (Model Context Protocol)

---

### 8.8 – MCP Server Integration [DONE]

- [x] Create `@sdd-bundle-editor/mcp-server` package
- [x] Implement standard MCP resources and tools:
  - [x] `bundle://current` resource
  - [x] `read_entity` and `list_entities` tools
- [x] Implement Read-Only Context tools:
  - [x] `get_context` – Graph traversal for entity dependencies
  - [x] `get_conformance_context` – Profile rules and audit templates
- [x] Verify with stdio client scripts

---

### 8.9 – Conformance Testing Mode [DONE]

- [x] Update `Profile` schema to support `conformanceRules` and `auditTemplate`
- [x] Update sample bundle with conformance data
- [x] Implement `get_conformance_context` tool

---

### 8.3 – Change Proposal and Application

- [x] Implement change proposal workflow:
  - [x] Agent returns structured `ProposedChange[]` with entity modifications
  - [x] UI displays diff-style preview of proposed changes
  - [x] User can accept all, reject all, or request modifications

- [x] Implement change application:
  - [x] Apply accepted changes to in-memory bundle state (`ChangeApplicationService`)
  - [x] Write modified entities back to YAML files (`saveEntity`)
  - [x] Run full validation + lint pipeline
  - [x] If errors, report back to conversation / revert changes
  - [x] If clean, proceed to commit

- [x] Implement automatic Git commit:
  - [x] Use `git-utils` package for commit operations
  - [x] Generate commit message summarizing changes
  - [x] Commit only the modified entity files
  - [x] Report commit status to user as confirmation

---

### 8.4 – UI Modifications for Read-Only Mode

- [x] Remove or disable direct editing in `EntityDetails`:
  - [x] Entity forms become read-only viewers (via `ReadOnlyToggle`)
  - [x] Save button hidden in read-only mode
  - [x] Clear visual indication that editing is via agent only

- [x] Add "Edit via Agent" call-to-action:
  - [x] Button/link that focuses agent panel
  - [ ] Contextual prompts like "Fix diagnostics for this entity"

- [x] Add conversation panel to layout:
  - [x] Right panel design with collapsible state
  - [x] Integrated into AppShell layout
  - [ ] Keyboard shortcut to open agent panel

---

### 8.5 – Error Recovery and Edge Cases

- [x] Handle conversation interruptions:
  - [x] Dirty Git state detected mid-conversation (health endpoint + UI warning banner)
  - [x] Network/backend failures during agent communication (fetchWithRetry + error indicator)
  - [ ] User closes browser/editor during pending changes

- [x] **8.5 Rollback Capability**
  - [x] Backend: Add `POST /agent/rollback` (revert uncommitted changes, keeps conversation active)
  - [x] UI: Add "Discard Changes" button to pending changes block
  - [x] UI: Update `AppShell` to handle rollback and refresh UI state

---

### 8.6 – Testing and Documentation

- [x] Add unit tests for conversation protocol and state machine (`ChangeApplicationService.test.ts`)
- [x] Add integration tests for agent backend communication
- [x] Add E2E Playwright tests for:
  - [x] Starting conversation (Git check) – `agent-conversation.spec.ts`
  - [x] Sending message and receiving response – `agent-conversation.spec.ts`
  - [x] Accepting changes and verifying commit – `agent-change-application.spec.ts`
  - [x] Aborting conversation – `agent-editing.spec.ts`
- [x] Update `AGENTS.md` with agent-first editing workflow documentation
- [ ] Update README with new usage patterns

---

## Future / Stretch Work

- [ ] Replace the no-op AI provider with real `http` or `cli` provider in `core-ai`  
  *(Foundational for Phase 8.2 agent backends)*

- [ ] Add richer example bundles:
  - [ ] Protocol spec bundle (e.g., EC-OPRF/FHE-style)
  - [ ] Feature-based project bundle (e.g., Feature 006-style EUDIW simulator)

- [ ] Investigate MCP integration for standardized agent communication

- [ ] Explore VS Code extension for tighter agent integration than web UI

- [ ] **AI Self-Critique Loop**: Iterative spec refinement workflow where:
  1. AI reviews the current bundle/spec and identifies issues or improvements
  2. AI proposes changes with explanations
  3. Human reviews and approves/rejects each change
  4. Loop continues until AI is satisfied (no further suggestions)
  5. All approved changes are committed as a batch
  
  *This enables "polish until done" workflows where AI drives the refinement process.*

- [ ] **Standalone Bundle Server Mode**: Create a dedicated server application that:
  1. Serves multiple spec bundles via HTTP (read-only API endpoints)
  2. Exposes bundle content, schemas, and metadata for MCP tool consumption
  3. Runs independently of the UI as a headless service
  4. Could support stdio mode for CLI/MCP integration
  5. Client applications (including this editor) can connect to consume specs
  
  *This enables agents to query and consume spec bundles programmatically via MCP tools.*

