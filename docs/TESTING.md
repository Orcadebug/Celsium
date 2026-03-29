# ForgeSync Testing Checklist

Use this checklist when validating the current hosted ForgeSync flows in `apps/forgesync`.

## Prerequisites

- Install dependencies: `npm install`
- Run typecheck: `npm run typecheck`
- Run lint: `npm run lint`
- Run tests: `npm --workspace apps/forgesync test -- --run`
- Run dev server from repo root: `npm run dev:web`

## Endpoint Validation Checklist

### Common expectations (all endpoints)

- [ ] Returns JSON responses.
- [ ] Valid payload returns HTTP `200`.
- [ ] Invalid/missing required field returns HTTP `400` with `{ ok: false, error: string }`.

### Hosted user flows

- [ ] `/login` sends a magic link successfully.
- [ ] `/auth/callback` rejects open redirects and falls back to `/dashboard`.
- [ ] `/dashboard` redirects unauthenticated users to `/login`.
- [ ] Repo creation appears immediately on the dashboard.
- [ ] `/dashboard/[projectId]` shows project name, token actions, and active sessions.
- [ ] Browser-based CLI link flow completes and redirects to the localhost callback URL.

### Agent session + knowledge APIs

- [ ] `POST /api/agent/session/start` accepts `agent_id` (required) and `run_id` (optional).
- [ ] `POST /api/agent/session/end` requires `session_id`.

### Decisions, memory, and knowledge

- [ ] `POST /api/agent/decision` requires `session_id` + `decision`.
- [ ] `POST /api/agent/memory` requires `session_id` + `content`.
- [ ] `GET /api/agent/knowledge/query` returns unified results for supported kinds.
- [ ] `POST /api/agent/repo/sync` accepts chunked file payloads and deleted paths.

### Task lifecycle

- [ ] `POST /api/agent/task/claim` requires `session_id` + `task_id`.
- [ ] `POST /api/agent/task/complete` requires `session_id` + `task_id`.

### Lock lifecycle

- [ ] `POST /api/agent/lock` requires `session_id` + `resource`.
- [ ] `POST /api/agent/unlock` requires `session_id` + `resource`.

## Suggested smoke tests

```bash
curl -X POST http://localhost:3000/api/health

curl -X POST http://localhost:3000/api/agent/session/start \
  -H "content-type: application/json" \
  -H "x-forgesync-token: ${FORGESYNC_AGENT_API_TOKEN}" \
  -d '{"project_id":"proj-1","agent_id":"agent-123"}'

curl -X POST http://localhost:3000/api/agent/repo/sync \
  -H "content-type: application/json" \
  -H "x-forgesync-token: ${FORGESYNC_AGENT_API_TOKEN}" \
  -d '{"project_id":"proj-1","session_id":"session-1","files":[],"deleted_paths":[]}'
```
