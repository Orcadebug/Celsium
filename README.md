# Celsium / ForgeSync

ForgeSync is a hosted context layer for AI coding agents. It combines:

- a Next.js app for hosted repos, auth, tokens, CLI linking, and agent APIs
- a CLI for session lifecycle, context capture, repo sync, locks, and project DNA
- a Supabase-backed storage layer for sessions, knowledge, locks, tasks, and embeddings

## Current Product Surface

### Hosted web app
- email magic-link sign-in
- dashboard for creating hosted repos
- per-repo detail page for:
  - CLI onboarding commands
  - active session visibility
  - API token creation and revocation
- browser-based CLI link flow

### Agent / hosted APIs
- session start, resume, and end
- knowledge upload and unified knowledge query
- decisions, memory, chain-of-thought traces, and project DNA
- locks and task claim/complete
- explicit repo sync from the CLI into hosted knowledge entries
- internal embedding processing endpoint
- health check endpoint

### CLI
- `init`
- `login`
- `sync`
- `start`
- `end`
- `run`
- `status`
- `upload`
- `decide`
- `remember`
- `think`
- `context`
- `resume`
- `lock`
- `unlock`
- `locks`
- `dna show`
- `dna set`

## Repo Layout
- `apps/forgesync` — Next.js app and hosted APIs
- `packages/forgesync-cli` — `forgesync` CLI
- `docs` — architecture, build summary, and testing notes

## Local Development

```bash
npm install
npm run typecheck
npm run lint
npm --workspace apps/forgesync test -- --run
npm run dev:web
```

### CLI quick start

```bash
# initialize local state
node packages/forgesync-cli/dist/index.js init --api http://localhost:3000

# browser-link this workspace to a hosted repo
node packages/forgesync-cli/dist/index.js login --api http://localhost:3000

# start a session
node packages/forgesync-cli/dist/index.js start --agent codex --intent "ship dashboard polish"

# sync the current workspace into the hosted repo
node packages/forgesync-cli/dist/index.js sync
```

## Environment

The web app expects these variables in development and deployment:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
FORGESYNC_AGENT_API_TOKEN=
FORGESYNC_INTERNAL_SECRET=
CRON_SECRET=
ALLOWED_ORIGINS=*
```

See `apps/forgesync/.env.example` for the template.

## Verification

Current expected local checks:

- `npm run typecheck`
- `npm run lint`
- `npm --workspace apps/forgesync test -- --run`

## Remaining Work

The repo is past the scaffold stage, but it is not finished. The main open areas are:

- deeper dashboard polish and session/sync visibility
- browser-level E2E coverage beyond route-level tests
- deployment monitoring / error tracking
- load testing for the hosted APIs and embedding pipeline
- clearer deployment runbooks for Vercel + Supabase operations
