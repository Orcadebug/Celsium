# ForgeSync Build Summary

## What is ForgeSync?

ForgeSync is a **context layer** for AI agents — like git is for code, ForgeSync is for agent context. It stores and retrieves context so multiple autonomous agents working on the same codebase don't duplicate work or contradict each other.

**Beehive model**: User (queen bee) directs, AI agents (worker bees) execute, codebase (hive) is the shared workspace. ForgeSync is the shared brain that connects them all.

## The 4-Layer Context Model

| Layer | Name | What It Stores | Tech |
|-------|------|---------------|------|
| 1 | **Project DNA** | Rules, conventions, structure | JSONB column on `projects` table |
| 2 | **Living Memory** | Facts, patterns, decisions (semantic search) | pgvector + Gemini text-embedding-004 |
| 3 | **Chain-of-Thought** | How agents reasoned through problems | `cot_traces` table + vector embeddings |
| 4 | **Active State** | Locks, active sessions, open tasks | Simple DB queries |

## Architecture

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Terminal 1  │   │  Terminal 2  │   │  Terminal 3  │
│ (Agent: BE)  │   │ (Agent: FE)  │   │ (Agent: Test)│
└──────┬───────┘   └──────┬───────┘   └──────┬───────┘
       │                  │                   │
       └──────────┬───────┴───────────────────┘
                  │  CLI commands / HTTP API
           ┌──────▼──────┐
           │  ForgeSync   │  (Next.js API)
           │  Context     │
           │  Layer       │
           └──────┬───────┘
                  │
           ┌──────▼──────┐
           │  Supabase    │  (pgvector + RLS)
           │  + Gemini    │  (embeddings)
           └──────────────┘
```

## What Was Built

### Database (Supabase + pgvector)

**Existing tables** (from initial schema):
- `projects`, `agents`, `sessions`, `decisions`, `memory_entries`, `file_locks`, `tasks`
- Vector indexes (IVFFlat, cosine) on `decisions.embedding` and `memory_entries.embedding`

**New in migration 003_context_layer.sql**:
- `dna` JSONB column on `projects` — stores project rules/conventions
- `cot_traces` table — chain-of-thought reasoning with vector(768) embedding
- `embedding_queue` table — persistent background job queue for embedding generation
- 3 RPC functions: `match_memories()`, `match_decisions()`, `match_cot_traces()` — vector similarity search

### API Routes (14 total)

#### Context Write Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agent/memory` | POST | Save a memory (fact, pattern) + enqueue embedding |
| `/api/agent/decision` | POST | Record a decision + enqueue embedding |
| `/api/agent/cot` | POST | Save chain-of-thought trace + enqueue embedding |
| `/api/agent/project/dna` | PUT | Update project DNA (rules, conventions) |

#### Context Read Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agent/memory/query` | GET | Vector similarity search on memories |
| `/api/agent/cot/query` | GET | Vector similarity search on reasoning traces |
| `/api/agent/project/dna` | GET | Retrieve project DNA |
| `/api/agent/session/start` | POST | **Context hydration** — returns all 4 layers based on intent |

#### Lock Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agent/lock` | POST | Acquire file lock (conflict detection, 30min TTL) |
| `/api/agent/unlock` | POST | Release file lock (ownership validation) |
| `/api/agent/locks` | GET | List all active locks |

#### Session & Task Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agent/project/init` | POST | Upsert project in DB |
| `/api/agent/session/end` | POST | End session, update status |
| `/api/agent/task/claim` | POST | Claim a task (double-claim rejection) |
| `/api/agent/task/complete` | POST | Mark task completed |

#### Internal
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/internal/process-embeddings` | POST | Cron endpoint to process embedding queue |

### Embedding Pipeline

- **Model**: Gemini `text-embedding-004` (768 dimensions)
- **Storage flow**: Write routes save text → enqueue job → `after()` processes inline → cron picks up failures
- **Search flow**: Query text embedded inline with `RETRIEVAL_QUERY` task type → cosine similarity via pgvector
- **Retry**: Max 3 attempts, then marked `failed` for review

### CLI Commands (15 total)

```
# Setup
forgesync init                                    # Initialize project (like git init)
forgesync status                                  # Show project status, active sessions

# Session lifecycle
forgesync start --agent <name> --intent "..."     # Begin session, get hydrated context
forgesync end                                     # End current session
forgesync run <agent> --cmd "..." --intent "..."  # Wrap command with session lifecycle

# Context (push)
forgesync decide "<text>"                         # Record a decision
forgesync remember "<text>"                       # Save a memory/fact
forgesync think "<text>"                          # Save chain-of-thought reasoning

# Context (pull)
forgesync context "<query>"                       # Semantic search for relevant context

# Locks
forgesync lock <path>                             # Lock a file/directory
forgesync unlock <path>                           # Release a lock
forgesync locks                                   # List all active locks

# Project DNA
forgesync dna show                                # View project rules/conventions
forgesync dna set '<json>'                        # Set project DNA
```

### Tests

- **14 test files, 55 tests** — all passing
- Tests cover: input validation, auth (token/bearer/permissive), response shapes, conflict detection (locks, task double-claim), embedding pipeline (Gemini API mock, retry logic)

| Test File | Tests | What It Covers |
|-----------|-------|----------------|
| `shared.test.ts` | 18 | Validation helpers, auth |
| `session-start.test.ts` | 3 | Context hydration response shape |
| `session-end.test.ts` | 2 | Session end |
| `decision.test.ts` | 3 | Decision save + embedding enqueue |
| `memory.test.ts` | 2 | Memory save + embedding enqueue |
| `memory-query.test.ts` | 3 | Vector search + session fallback |
| `lock.test.ts` | 3 | Lock acquire + conflict (409) |
| `unlock.test.ts` | 2 | Lock release |
| `task-claim.test.ts` | 2 | Task claim |
| `task-complete.test.ts` | 2 | Task complete |
| `project-init.test.ts` | 2 | Project upsert |
| `project-dna.test.ts` | 4 | DNA GET/PUT |
| `cot.test.ts` | 5 | CoT save + query |
| `embedding-queue.test.ts` | 4 | Gemini API, task types, errors |

## Example Workflow

```bash
# Terminal 1: Backend agent
forgesync start --agent backend --intent "build user auth API"
# → Gets context: project DNA, relevant memories, active locks
forgesync decide "Using JWT with refresh tokens, 7-day expiry"
forgesync remember "Auth routes at /api/v1/auth/*, tokens in httpOnly cookies"
forgesync lock src/api/auth/
# ... agent works ...
forgesync unlock src/api/auth/
forgesync end

# Terminal 2: Frontend agent (starts later)
forgesync start --agent frontend --intent "build login page"
# → Gets context including backend's decisions and memories:
#   "Auth routes at /api/v1/auth/*" (95% match)
#   "JWT with refresh tokens" (89% match)
#   Locked files: none (backend already unlocked)
# Agent builds login page correctly on first try
forgesync end

# Terminal 3: Test agent
forgesync start --agent tester --intent "write auth integration tests"
# → Gets ALL context from both agents
# Writes comprehensive tests matching actual implementation
forgesync end
```

## File Structure

```
apps/forgesync/
  src/app/api/
    agent/
      _shared.ts              # Validation, auth, response helpers
      _supabase.ts            # Supabase client singleton (NEW)
      _embeddings.ts          # Gemini embeddings + queue processor (NEW)
      session/start/route.ts  # Context hydration (REWRITTEN)
      session/end/route.ts    # Session end (WIRED)
      decision/route.ts       # Decision save (WIRED)
      memory/route.ts         # Memory save (WIRED)
      memory/query/route.ts   # Vector search (WIRED)
      lock/route.ts           # Lock acquire + conflict check (WIRED)
      unlock/route.ts         # Lock release (WIRED)
      locks/route.ts          # List active locks (NEW)
      task/claim/route.ts     # Task claim (WIRED)
      task/complete/route.ts  # Task complete (WIRED)
      project/init/route.ts   # Project upsert (WIRED)
      project/dna/route.ts    # DNA GET/PUT (NEW)
      cot/route.ts            # CoT save (NEW)
      cot/query/route.ts      # CoT vector search (NEW)
    internal/
      process-embeddings/route.ts  # Cron embedding processor (NEW)
  src/__tests__/              # 14 test files, 55 tests
  supabase/migrations/
    001_initial_schema.sql
    002_enable_rls.sql
    003_context_layer.sql     # DNA, CoT, embedding queue (NEW)

packages/forgesync-cli/
  src/index.ts                # 15 CLI commands (EXTENDED)
```

## What's Next (Future Work)

| Feature | Description |
|---------|-------------|
| Task CRUD | Create/list/filter tasks (only claim/complete exist) |
| Agent registration | Register agents with capabilities |
| Event bus | Real-time notifications via Supabase Realtime |
| Auto-decomposition | Break high-level goals into sub-tasks |
| Dashboard UI | Web UI for monitoring agents and context |
| File-level permissions | Per-agent file access rules |
| Gemini context caching | Cache project DNA for cost-efficient agent startup |
| CLI `--strict` mode | Fail hard if API is unreachable |
| RLS policies | Fine-grained DB access control |
