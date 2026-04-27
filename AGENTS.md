# AGENTS.md — Beads Swarm Plugin

## Project

Single-file opencode plugin (`src/plugin.ts`) exporting `BeadsSwarmPlugin`. Configures 10 agents and a `shell.env` hook.

**Stack:** TypeScript, `@opencode-ai/plugin` SDK, Bun runtime
**Check:** `npm run typecheck` (runs `tsc --noEmit`)
**No build step.** Plugin is consumed directly from source.

## File Structure

```
src/plugin.ts    ← All agent configs and hooks live here
AGENTS.md        ← This file (coding guidance)
README.md        ← Project overview for the owner
```

## Agent Hierarchy

```
Archdruid (primary) → Seer (plan) → Beastmaster (dispatch) → Critter (implement)
     ▲                                       │
     └──────────── blocker report ◄───────────┘
```

Critters report to Beastmaster. Beastmaster reports to Archdruid. Archdruid routes to Seer (replan) or user (clarify). **No agent bypasses its caller.**

## How Agents Spawn Each Other

Archdruid delegates via the built-in Task tool (`subagent_type` parameter). Beastmaster spawns critters the same way: `Task(subagent_type="critter", ...)`. Each spawned agent runs in its own child session.

## Git Strategy

Each critter creates a feature branch `bd-<id>` from current HEAD. Parallel critters never conflict because they push to separate branches.

## Global Hooks

### `shell.env`

Sets `GIT_PAGER=cat` and `GIT_TERMINAL_PROMPT=0` on all shell invocations. Agent prompts do not need to set these manually.

## Beads Issue Tracker (bd)

Backed by Dolt. Key commands:

| Command | Used by | Purpose |
|---------|---------|---------|
| `bd init --non-interactive` | Seer | Initialize tracker (idempotent) |
| `bd create --title="..." --description="..." --type=task -p <0-4> --labels <label> --json` | Seer | Create ticket |
| `bd dep add <blocked-id> <blocker-id> --json` | Seer | Wire dependency graph |
| `bd ready --json` | Beastmaster | List unblocked open tasks |
| `bd show <id> --json` | Beastmaster, Critter | Read ticket details |
| `bd update <id> --status in_progress --json` | Beastmaster | Mark in progress |
| `bd close <id> --reason="..." --json` | Critter | Close ticket |
| `bd dolt push` | Critter | Sync tracker to Dolt remote |
| `bd list --status open --json` | Seer, Beastmaster | List open tickets |

**Never use `bd edit`** — opens interactive editor, hangs the agent. Use `bd update`.

## Agent Constraints (All Agents)

- **FAIL FAST:** Max 2 attempts to fix any failing test/bug. Stop and report after 2 failures.
- **ANTI-HANG:** Always set `timeout` on bash tool calls (e.g., `timeout: 30000`).
- **ANTI-HANG:** Never use `bd edit`. Use `bd update <id> --field="value"`.
- **NO SECRETS:** Never read or expose `.env`, credentials, API keys, or secret files.
- **STAY IN SCOPE:** Implement only what the ticket describes. Do not refactor unrelated code.

## Labels

Every ticket carries exactly one domain label:
- `frontend` — HTML, CSS, JS, templates, UI components, static assets
- `backend` — Python, FastAPI, APIs, database, server logic, config

## Agent Reference

| Agent | Model | Mode | Steps | Can Edit | Bash |
|-------|-------|------|-------|----------|------|
| archdruid | gemini-3-pro-preview | primary | 30 | no | — |
| seer | claude-opus-4-6 | subagent (hidden) | 30 | no | `bd *` only |
| beastmaster | glm-4.7-flashx | subagent | 50 | no | `bd ready/list/show/update` only |
| critter | glm-5.1 | subagent | 40 | yes | git, bd show/close/dolt, npm/pytest/make test, ls |
| thread | glm-4.7-flashx | subagent | 15 | no | git, grep, find, ls |
| spindle | glm-5.1 | subagent | 15 | no | none |
| weft | glm-5.1 | subagent | — | no | none |
| warp | glm-5.1 | subagent | — | no | none |
| security-audit | minimax-m2.5-free | subagent | — | no | none |
| docs-writer | glm-5.1 | subagent | 20 | yes | none |

Weft, Warp, and Security-Audit are not yet finished. Their prompts and permissions are minimal placeholders.

## Making Changes

When editing `src/plugin.ts`:
- All agent configs are in the `config` callback. Each is a block under `config.agent["name"]`.
- Permission objects use glob patterns for bash commands. `"*": "deny"` is the default-deny base.
- The `steps` field caps agentic iterations. Set it on every finished agent.
- The `hidden: true` flag on seer keeps it out of the @ autocomplete menu.
- Run `npm run typecheck` after any edit to verify.
