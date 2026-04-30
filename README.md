# opencode-rampart

A multi-agent orchestration plugin for [opencode](https://opencode.ai) that turns a natural language request into a planned, dispatched, and implemented set of changes — using the [beads](https://github.com/beads-project/beads) issue tracker as the coordination backbone.

## What It Does

You describe what you want built. The plugin breaks it into tickets, dispatches coding agents to work them in parallel, and delivers committed code on feature branches.

```
You: "Add user authentication with JWT tokens and a login page"

  Archdruid receives your request
    → Seer breaks it into 6 beads tickets with dependencies
    → Beastmaster picks 2 ready tickets and spawns Critters
    → Critter A implements the JWT middleware on branch bd-12
    → Critter B implements the login endpoint on branch bd-13
    → Beastmaster picks the next 2 ready tickets...
    → Sprint completes
  Archdruid reports back to you
```

No commands to memorize. Just talk to it.

## The Agents

### Core Pipeline

**Archdruid** is your interface. It's the primary agent — the one you talk to. It never writes code itself. It understands what you want and routes work to the right specialist.

**Seer** is the planner. It takes your request and produces a structured backlog of beads tickets with acceptance criteria, priorities, labels, and a dependency graph. It runs on Claude Opus for planning quality. You never interact with Seer directly — Archdruid delegates to it.

**Beastmaster** is the dispatcher. It polls the beads ready queue, picks up to 2 unblocked tickets at a time, and spawns Critter agents to work them in parallel. When a critter finishes, Beastmaster loops back for the next batch. When something fails, it stops and reports up.

**Critter** is the implementer. Each critter receives one ticket, explores the codebase to learn conventions, writes the code, runs tests, commits to a feature branch (`bd-<id>`), closes the ticket, and syncs the tracker. It has a strict 2-attempt limit on fixing failures — if something doesn't work after two tries, it stops and reports the blocker rather than burning context.

### Support Agents

**Thread** — fast, read-only codebase explorer. Critters delegate to it when they need to understand project structure or find existing patterns. Cheap model, no file editing.

**Spindle** — external researcher. Fetches documentation, API references, and web resources. Used when an agent needs information that isn't in the codebase.

**Docs Writer** — writes technical documentation. READMEs, API docs, changelogs, guides. Can edit files and fetch web content for reference.

## How It Works Under the Hood

### Beads + Dolt

The [beads](https://github.com/beads-project/beads) issue tracker (backed by [Dolt](https://www.dolthub.com/)) is the single source of truth for task state. Agents don't pass task info through conversation context — they read and write tickets via the `bd` CLI. This means:

- Seer creates tickets → they exist in the tracker
- Beastmaster reads `bd ready` → gets the real unblocked queue
- Critter closes a ticket → Beastmaster sees it on next poll
- `bd dolt push` syncs state to the Dolt remote

This decoupled design means agents don't need to share conversational context to coordinate. The tracker is the shared state.

### Branching

Each critter creates a feature branch named `bd-<id>` from the current HEAD. Two critters working in parallel push to `bd-12` and `bd-13` — separate branches, no conflicts. Merging is a separate step (not handled by the plugin).

### Blocker Escalation

When something goes wrong, it flows up the chain:

```
Critter hits a blocker
  → reports to Beastmaster (its caller)
  → Beastmaster stops dispatching, reports to Archdruid (its caller)
  → Archdruid decides:
      - needs replanning? → delegates back to Seer
      - needs your input? → asks you directly
```

No agent bypasses its caller. No agent silently retries. Blockers surface immediately.

### Safety Rails

- **Fail fast:** Every coding agent has a 2-attempt limit on fixing failures. No infinite retry loops.
- **Step limits:** Every finished agent has a hard cap on agentic iterations (steps). Archdruid: 30, Beastmaster: 50, Critter: 40, etc.
- **Bash lockdown:** Each agent only has access to the specific shell commands it needs. Critter can run `git`, `npm test`, `pytest`, `make test`, `ls`, and `bd` commands — nothing else. Beastmaster can only run `bd` commands. Thread can only read.
- **No secrets:** All agents are instructed to never read `.env` files, credentials, or API keys.
- **Anti-hang:** A global `shell.env` hook sets `GIT_PAGER=cat` and `GIT_TERMINAL_PROMPT=0` on every shell invocation, preventing git from spawning interactive prompts. `bd edit` is banned (opens vim).

## Installation

Add the plugin to your opencode config:

```json
{
  "plugin": ["opencode-rampart"]
}
```

Or install from the repo:

```json
{
  "plugin": ["github:Balakirev1837/opencode-rampart"]
}
```

### Prerequisites

- [opencode](https://opencode.ai) installed and configured
- [beads](https://github.com/beads-project/beads) (`bd` CLI) installed and available on PATH
- [Dolt](https://www.dolthub.com/) installed (beads backend)
- API keys configured for the models used by the agents:
  - Google (Gemini) — for Archdruid
  - OpenRouter — for Seer (Claude Opus) and Beastmaster (Claude Haiku)
  - ZAI (GLM) — for Critter, Thread, Spindle, Docs Writer

## Project Structure

```
src/
  plugin.ts    ← Single file. All agent configs, prompts, permissions, and hooks.
AGENTS.md      ← Coding instructions for agents working on this project.
README.md      ← This file.
```

There is no build step. The plugin is consumed directly from source by opencode.

```bash
npm run typecheck   # Type-check the project (the only check available)
```

## Status

This is v0.1. The core pipeline (Archdruid → Seer → Beastmaster → Critter) is designed and configured. Support agents (Thread, Spindle, Docs Writer) are available for delegation.

Future work:
- Git worktree support via opencode's workspace adaptor (instead of feature branches)
- Configurable parallelism limit (currently hardcoded to 2 critters)
- Post-sprint merge automation
- Code quality and security review agents
