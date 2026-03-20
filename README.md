# Celsium / ForgeSync

AI-native software development platform.

## Monorepo Layout
- `apps/forgesync` — Next.js app (dashboard + agent coordination API)
- `packages/forgesync-cli` — CLI (`forgesync`) for agent workflows
- `docs` — architecture + roadmap

## Current Status
Scaffolded foundation for:
- intent/decision-first coordination API
- shared memory + lock model
- CLI command framework
- Supabase schema migration starter

## ForgeSync CLI quick start

```bash
# from repo root
npm install
npm --workspace packages/forgesync-cli run build

# initialize local project state
node packages/forgesync-cli/dist/index.js init --project-id demo-project

# start an agent session
node packages/forgesync-cli/dist/index.js start --agent codex --branch feat/demo --task "add session lifecycle"

# show local status
node packages/forgesync-cli/dist/index.js status

# end latest active session
node packages/forgesync-cli/dist/index.js end
```

### Optional remote API wiring

Set `FORGESYNC_API_URL` (or pass `--api` to `init`) to enable remote sync scaffolding:

```bash
FORGESYNC_API_URL=http://localhost:3000 node packages/forgesync-cli/dist/index.js init
```

When configured, `init/start/end` attempt POST calls to:
- `/api/agent/project/init`
- `/api/agent/session/start`
- `/api/agent/session/end`

Remote failures are non-fatal so local workflow keeps working offline.

## Next External Connections Required
- Supabase project credentials
- Vercel project/token
- Gemini API key for embeddings
