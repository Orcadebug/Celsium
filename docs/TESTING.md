# Agent API Testing Checklist

Use this checklist when validating the scaffolded agent endpoints in `apps/forgesync`.

## Prerequisites

- Install dependencies: `npm install`
- Build once: `npm run build:web`
- Run dev server from repo root: `npm run dev:web`

## Endpoint Validation Checklist

### Common expectations (all endpoints)

- [ ] Returns JSON responses.
- [ ] Valid payload returns HTTP `200`.
- [ ] Invalid/missing required field returns HTTP `400` with `{ ok: false, error: string }`.

### Session

- [ ] `POST /api/agent/session/start` accepts `agent_id` (required) and `run_id` (optional).
- [ ] `POST /api/agent/session/end` requires `session_id`.

### Decisions and memory

- [ ] `POST /api/agent/decision` requires `session_id` + `decision`.
- [ ] `POST /api/agent/memory` requires `session_id` + `content`.
- [ ] `GET /api/agent/memory/query` requires query param `session_id`.

### Task lifecycle

- [ ] `POST /api/agent/task/claim` requires `session_id` + `task_id`.
- [ ] `POST /api/agent/task/complete` requires `session_id` + `task_id`.

### Lock lifecycle

- [ ] `POST /api/agent/lock` requires `session_id` + `resource`.
- [ ] `POST /api/agent/unlock` requires `session_id` + `resource`.

## Suggested smoke tests

```bash
curl -X POST http://localhost:3000/api/agent/session/start \
  -H "content-type: application/json" \
  -d '{"agent_id":"agent-123"}'

curl -X POST http://localhost:3000/api/agent/task/claim \
  -H "content-type: application/json" \
  -d '{}'

curl "http://localhost:3000/api/agent/memory/query"
```
