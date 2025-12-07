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

- [ ] Design and implement a chat/prompt panel in the UI:
  - [ ] Text input for user prompts
  - [ ] Conversation history display (user messages, agent responses)
  - [ ] "Start conversation" action that validates Git status first
  - [ ] Visual indicators for conversation state (idle, awaiting response, changes pending, linting, committed)

- [ ] Implement conversation protocol types:
  - [ ] `ConversationMessage` (role: user | agent, content, timestamp)
  - [ ] `ConversationState` (idle | active | pendingChanges | linting | committed | error)
  - [ ] `ProposedChange` (entity, field, oldValue, newValue, rationale)

- [ ] Add conversation management to backend:
  - [ ] `POST /agent/start` – Initialize conversation (checks Git clean status)
  - [ ] `POST /agent/message` – Send user message, get agent response
  - [ ] `POST /agent/accept` – Accept proposed changes, apply, lint, commit
  - [ ] `POST /agent/abort` – Abort conversation without applying changes
  - [ ] `GET /agent/status` – Current conversation state

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

- [ ] Implement change proposal workflow:
  - [ ] Agent returns structured `ProposedChange[]` with entity modifications
  - [ ] UI displays diff-style preview of proposed changes
  - [ ] User can accept all, reject all, or request modifications

- [ ] Implement change application:
  - [ ] Apply accepted changes to in-memory bundle state
  - [ ] Write modified entities back to YAML files
  - [ ] Run full validation + lint pipeline
  - [ ] If errors, report back to conversation for fix-up
  - [ ] If clean, proceed to commit

- [ ] Implement automatic Git commit:
  - [ ] Use `git-utils` package for commit operations
  - [ ] Generate commit message summarizing changes
  - [ ] Commit only the modified entity files
  - [ ] Report commit hash to user as confirmation

---

### 8.4 – UI Modifications for Read-Only Mode

- [ ] Remove or disable direct editing in `EntityDetails`:
  - [ ] Entity forms become read-only viewers
  - [ ] No "Save" button on individual entities
  - [ ] Clear visual indication that editing is via agent only

- [ ] Add "Edit via Agent" call-to-action:
  - [ ] Button/link that opens conversation panel with entity context
  - [ ] Contextual prompts like "Fix diagnostics for this entity"

- [ ] Add conversation panel to layout:
  - [ ] Consider right panel or modal for conversation
  - [ ] Collapsible/expandable design
  - [ ] Keyboard shortcut to open agent panel

---

### 8.5 – Error Recovery and Edge Cases

- [ ] Handle conversation interruptions:
  - [ ] Dirty Git state detected mid-conversation
  - [ ] Network/backend failures during agent communication
  - [ ] User closes browser/editor during pending changes

- [ ] Implement rollback capability:
  - [ ] If lint fails repeatedly, offer to abort and leave files unchanged
  - [ ] Clear in-memory pending changes on abort

- [ ] Add conversation persistence (optional):
  - [ ] Store conversation history locally for review
  - [ ] Allow resuming interrupted conversations if state permits

---

### 8.6 – Testing and Documentation

- [ ] Add unit tests for conversation protocol and state machine
- [ ] Add integration tests for agent backend communication
- [ ] Add E2E Playwright tests for:
  - [ ] Starting conversation (Git check)
  - [ ] Sending message and receiving response
  - [ ] Accepting changes and verifying commit
  - [ ] Aborting conversation
- [ ] Update `AGENTS.md` with agent-first editing workflow documentation
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

