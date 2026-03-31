# OpenCode Diagnostics

Quick lookup for diagnosing binding-harness runs that use OpenCode as the builder runtime.

## First Places To Look

For a specific harness run directory:

- builder stderr:
  - `logs/opencode.implementation.stderr.log`
- builder stdout:
  - `logs/opencode.implementation.stdout.log`
- builder observability summary:
  - `builder-observability.json`
- effective run settings:
  - `packets/run-settings.json`

These are the fastest local artifacts for seeing:
- active model
- active builder profile
- whether MCP was connected
- read/write/edit/bash/glob/grep counts
- the last meaningful OpenCode event

## OpenCode Local State

OpenCode also stores local process/session state outside the harness run:

- line-oriented logs:
  - `~/.local/share/opencode/log/*.log`
- SQLite state:
  - `~/.local/share/opencode/opencode.db`
- session diffs:
  - `~/.local/share/opencode/storage/session_diff/*.json`

In practice:
- `session_diff/*.json` may be empty
- `opencode.db` is often the most useful deeper source

## SQLite Queries

List tables:

```bash
sqlite3 'file:/home/ivan/.local/share/opencode/opencode.db?mode=ro' '.tables'
```

Show schemas:

```bash
sqlite3 'file:/home/ivan/.local/share/opencode/opencode.db?mode=ro' '.schema session'
sqlite3 'file:/home/ivan/.local/share/opencode/opencode.db?mode=ro' '.schema message'
sqlite3 'file:/home/ivan/.local/share/opencode/opencode.db?mode=ro' '.schema part'
sqlite3 'file:/home/ivan/.local/share/opencode/opencode.db?mode=ro' '.schema event'
```

Count messages for a session:

```bash
sqlite3 'file:/home/ivan/.local/share/opencode/opencode.db?mode=ro' \
  "select count(*), min(time_created), max(time_created) from message where session_id='<SESSION_ID>';"
```

Inspect recent message rows:

```bash
sqlite3 'file:/home/ivan/.local/share/opencode/opencode.db?mode=ro' \
  "select id, time_created, substr(data,1,400) from message where session_id='<SESSION_ID>' order by time_created desc limit 8;"
```

Inspect recent parts for text/tool activity:

```bash
sqlite3 'file:/home/ivan/.local/share/opencode/opencode.db?mode=ro' \
  "select id, message_id, time_created, substr(data,1,500) from part where session_id='<SESSION_ID>' order by time_created desc limit 12;"
```

Extract token/cache info:

```bash
sqlite3 'file:/home/ivan/.local/share/opencode/opencode.db?mode=ro' \
  "select json_extract(data,'$.modelID'), json_extract(data,'$.tokens.total'), json_extract(data,'$.tokens.input'), json_extract(data,'$.tokens.output'), json_extract(data,'$.tokens.cache.read'), json_extract(data,'$.tokens.cache.write') from message where session_id='<SESSION_ID>' order by time_created desc limit 8;"
```

## What The DB Helped Reveal

Useful patterns we have already seen:

- A builder run can be genuinely successful even if the final harness gate fails.
  The DB can show a stable completion summary like:
  - all required output paths verified
  - tests passing
  - build succeeding
- Short, stalled sessions usually show:
  - very few assistant messages
  - read-heavy parts
  - little or no edit/bash activity
- Cache-heavy token totals often indicate iterative in-context repair rather than a fresh failure each turn.

## Current Practical Interpretation

When diagnosing an OpenCode builder run:

1. Check `builder-observability.json`.
2. Read `logs/opencode.implementation.stderr.log`.
3. If the behavior is still unclear, inspect the session in `opencode.db`.
4. Prefer the `message` and `part` tables over `session_diff`.
