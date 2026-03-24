# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Celsium/ForgeSync is an AI-native software development platform. It provides agent session coordination, shared memory, locks, tasks, and decision tracking through a web API and CLI.

## Monorepo Structure

npm workspaces monorepo with two packages:

- **`apps/forgesync`** — Next.js 15 app (App Router). Dashboard UI + agent coordination REST API at `/api/agent/*`.
- **`packages/forgesync-cli`** — `forgesync` CLI (Commander.js, ESM, TypeScript). Manages local session lifecycle with optional remote API sync.

## Build & Run Commands

```bash
# Install all dependencies (from repo root)
npm install

# Web app (Next.js)
npm run dev:web          # start dev server (localhost:3000)
npm run build:web        # production build

# CLI
npm run dev:cli                                    # run CLI via tsx (no build needed)
npm --workspace packages/forgesync-cli run build   # compile TypeScript to dist/
node packages/forgesync-cli/dist/index.js <cmd>    # run compiled CLI
```

No test runner or linter is configured yet.

## Architecture

### Agent API (`apps/forgesync/src/app/api/agent/`)

Next.js App Router route handlers implementing the coordination API. All routes use shared helpers from `_shared.ts` (`ok`, `badRequest`, `requireString`, `optionalString`, `readJsonObject`, `requireAgentAuth`). Endpoint groups:

- **Session**: `session/start`, `session/end`
- **Decisions & Memory**: `decision`, `memory`, `memory/query`
- **Task lifecycle**: `task/claim`, `task/complete`
- **Locks**: `lock`, `unlock`
- **Project**: `project/init`

Auth is token-based via `FORGESYNC_AGENT_API_TOKEN` env var (checked in `requireAgentAuth`). When the token is unset, auth is skipped.

### CLI (`packages/forgesync-cli/src/index.ts`)

Single-file CLI with commands: `init`, `start`, `end`, `run`, `status`. Stores state locally in `.forgesync/` directory (config.json + state.json). Optionally syncs to the remote API when `FORGESYNC_API_URL` or `--api` is set. Remote failures are non-fatal.

The `run` command wraps an arbitrary shell command in a session lifecycle (start -> exec -> end).

### External Services

- **Supabase**: Schema migration starter; use service role key for backend paths (anon access blocked by RLS)
- **Vercel**: Deployment target (project: `forgesync`)
- **Gemini**: AI model integration (recommended: `gemini-2.5-flash`)

### Environment Variables

See `apps/forgesync/.env.example` for the full list. Key vars:
- `FORGESYNC_AGENT_API_TOKEN` — shared secret for agent API auth (both server-side and CLI `x-forgesync-token` header)
- `FORGESYNC_API_URL` — remote API base URL for CLI sync
- `SUPABASE_SERVICE_ROLE_KEY` — backend Supabase access
