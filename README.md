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

## Next External Connections Required
- Supabase project credentials
- Vercel project/token
- Gemini API key for embeddings