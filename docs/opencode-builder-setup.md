# OpenCode Builder Setup

This document records the current local setup for using `OpenCode` as a harness builder backend through a local `LiteLLM` proxy.

## Goal

Use `OpenCode` for autonomous code generation while keeping:

- Spec Studio MCP as the domain/tool layer
- LiteLLM as the OpenAI-compatible transport layer
- a non-Gemini builder model such as `glm-5-turbo`

## Current Local Baseline

- OpenCode binary: `~/.opencode/bin/opencode`
- Verified OpenCode version: `1.3.10`
- LiteLLM proxy URL: `http://127.0.0.1:4000`
- Verified model ID exposed through LiteLLM: `glm-5-turbo`

LiteLLM was intentionally not upgraded in this setup step.

## Global OpenCode Provider Config

OpenCode is configured globally in:

- [opencode.jsonc](/home/ivan/.config/opencode/opencode.jsonc)

The important part is a custom OpenAI-compatible provider pointing at the local LiteLLM proxy.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "litellm-local": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LiteLLM Local",
      "options": {
        "baseURL": "http://127.0.0.1:4000",
        "apiKey": "local-litellm",
        "timeout": 900000,
        "chunkTimeout": 60000
      },
      "models": {
        "glm-5-turbo": {
          "name": "GLM 5 Turbo via LiteLLM"
        }
      }
    }
  }
}
```

## What The Harness Does

For each OpenCode-backed builder run the harness writes a temporary per-run config under the generated workspace:

- `.opencode/opencode.jsonc`
- `.opencode/harness-instructions.md`
- `.opencode/binding-brief.md`

That temporary config currently does four things:

1. registers the local Spec Studio MCP server as a remote MCP server
2. pins both `model` and `small_model` to the selected builder model
3. loads the long harness instructions and resolved implementation brief as instruction files instead of putting the entire brief in the runtime message
4. defines a focused `harness-builder` OpenCode agent that:
   - is `primary`
   - can read, edit, write, and use bash
   - denies `task`, `webfetch`, `skill`, `question`, `plan_enter`, and `plan_exit`

The goal is to reduce open-ended exploration and keep the run closer to "write the files now".

## OpenCode Default Policy

When `--builderBackend opencode` is selected and you do not explicitly override the model flags, the harness now hard-codes these defaults:

- builder model: `litellm-local/glm-5-turbo`
- critic backend: `codex`
- critic model: `gpt-5.2`
- critic reasoning effort: `medium`

This keeps the LiteLLM/OpenCode path completely off Gemini by default.

## OpenCode Builder Profiles

The harness now supports two builder profiles for OpenCode:

- `default`
- `packet-only`
- `glm-strict`

### `default`

This is the broader profile.

It:
- keeps the focused `harness-builder` agent
- allows the builder to connect to the local Spec Studio MCP server
- still prefers local run artifacts over open-ended exploration

Use it when you still want OpenCode to have live MCP access during implementation.

### `packet-only`

This is the stricter profile for comparison and debugging.

It:
- keeps the same focused `harness-builder` agent
- does **not** attach the MCP server during the implementation phase
- tells the builder to work from local frozen artifacts only
- tells the builder not to inspect more than a small number of files before starting to write

This is the best profile when you want to test whether the model is getting stuck in tool-oriented exploration instead of implementation.

### `glm-strict`

This is the current GLM-specific comparison profile.

It:
- inherits the `packet-only` behavior
- keeps MCP disabled during implementation
- forbids `todowrite`
- forbids `glob`
- tells the builder not to create a todo list
- tells the builder that the first `write` or `edit` should happen within the first 3 tool calls
- uses a tighter direct-style runtime prompt aimed at forcing early code generation instead of workspace exploration

Use it when you want the strictest current OpenCode/LiteLLM builder path for `glm-5-turbo`.

## Harness Invocation

Use the builder backend flag:

```bash
pnpm binding:harness --builderBackend opencode --model litellm-local/glm-5-turbo
```

If you omit `--model`, the harness will now default to `litellm-local/glm-5-turbo` automatically for `--builderBackend opencode`.

Use the stricter packet-only profile like this:

```bash
pnpm binding:harness \
  --builderBackend opencode \
  --builderProfile packet-only \
  --model litellm-local/glm-5-turbo
```

Use the GLM-specific strict profile like this:

```bash
pnpm binding:harness \
  --binding BIND-python-pyjwt-library \
  --builderBackend opencode \
  --builderProfile glm-strict \
  --model litellm-local/glm-5-turbo \
  --mode self-verify \
  --clean \
  --port 3144 \
  --timeoutSeconds 300
```

Example Node smoke run:

```bash
pnpm binding:harness \
  --binding BIND-node-jose-library \
  --builderBackend opencode \
  --model litellm-local/glm-5-turbo \
  --mode generate-only \
  --skipAudit \
  --skipCritic \
  --clean \
  --port 3127 \
  --timeoutSeconds 300
```

Example Python smoke run:

```bash
pnpm binding:harness \
  --binding BIND-python-pyjwt-library \
  --builderBackend opencode \
  --model litellm-local/glm-5-turbo \
  --mode generate-only \
  --skipAudit \
  --skipCritic \
  --clean \
  --port 3128 \
  --timeoutSeconds 300
```

## What Has Been Verified

- `opencode run -m litellm-local/glm-5-turbo ...` works directly
- OpenCode can connect to the local Spec Studio MCP server from harness runs
- the harness can launch OpenCode for both Node and Python bindings
- frozen-test materialization still works before the builder phase
- builder observability is now written to `builder-observability.json`
- the full non-Gemini Python JWT path is now green end to end with:
  - builder `opencode + litellm-local/glm-5-turbo`
  - critic `codex + gpt-5.2`
  - critic reasoning `medium`

## Builder Observability

Each run now records a builder observability artifact:

- `builder-observability.json`

For OpenCode-backed runs this includes:
- backend
- builder profile
- OpenCode session id
- last meaningful non-streaming log event
- observed read/write/edit/bash/glob/grep counts from the log
- whether MCP was connected
- observed MCP tool-invocation count from the log

The harness now also names builder log artifacts by the actual backend, for example:
- `logs/gemini.implementation.stdout.log`
- `logs/gemini.implementation.stderr.log`
- `logs/opencode.implementation.stdout.log`
- `logs/opencode.implementation.stderr.log`

This makes builder comparisons easier when a run times out or stalls.

For deeper diagnosis of OpenCode-backed builder behavior, use:

- [.agent/snippets/opencode-diagnostics.md](/home/ivan/dev/sdd-bundle-editor/.agent/snippets/opencode-diagnostics.md)

That snippet records the fastest places to inspect first, plus the useful read-only SQLite queries against the local OpenCode session database.

## Current Success Checkpoint

The current green checkpoints are:

- Python:
  - [report.json](/home/ivan/dev/sdd-bundle-editor/.scratch/binding-runs/2026-03-31T17-01-17-613Z-BIND-python-pyjwt-library/report.json)
- Node:
  - [report.json](/home/ivan/dev/sdd-bundle-editor/.scratch/binding-runs/2026-03-31T18-46-52-952Z-BIND-node-jose-library/report.json)

These runs used:

- builder backend: `opencode`
- builder model: `litellm-local/glm-5-turbo`
- builder profile: `glm-strict`
- critic backend: `codex`
- critic model: `gpt-5.2`
- critic reasoning effort: `medium`

They completed successfully with:

- Python:
  - normal builder exit
  - frozen-test integrity passed
  - dependency install passed
  - build passed
  - pytest passed
  - semantic audit passed
  - critic passed
  - final exit code `0`
- Node:
  - builder phase timed out, but the generated workspace still satisfied the outer acceptance gates
  - frozen-test integrity passed
  - `pnpm install` passed
  - `pnpm build` passed
  - `pnpm test` passed
  - semantic audit passed
  - critic passed

Builder observability for these runs shows that the stricter profile did change behavior materially:

- Python:
  - session id captured
  - `mcpConnected: false`
  - `read: 10`
  - `edit: 12`
  - `bash: 11`
  - `glob: 0`
  - `grep: 0`
- Node:
  - session id captured
  - `mcpConnected: false`
  - `read: 10`
  - `edit: 7`
  - `bash: 5`
  - `glob: 0`
  - `grep: 0`

That means the current setup is no longer just “wired correctly”; it is now a proven working delivery path for both the JWT Python and JWT Node pilots.

## Reproducing On Another Machine

1. install or upgrade `opencode`
2. ensure a local LiteLLM proxy is already running
3. ensure the LiteLLM proxy exposes `glm-5-turbo`
4. copy the provider config into `~/.config/opencode/opencode.jsonc`
5. run:

```bash
opencode models litellm-local
```

Expected output should include:

```text
litellm-local/glm-5-turbo
```

6. verify a direct model call:

```bash
opencode run -m litellm-local/glm-5-turbo --print-logs "Reply with exactly OK and nothing else."
```

7. then run the harness with `--builderBackend opencode`

## Related Docs

- [spec-generation-harness-next-architecture.md](/home/ivan/dev/sdd-bundle-editor/docs/spec-generation-harness-next-architecture.md)
- [spec-generation-harness-flow.md](/home/ivan/dev/sdd-bundle-editor/docs/spec-generation-harness-flow.md)
