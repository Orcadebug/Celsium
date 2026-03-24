-- 004_unified_knowledge.sql
-- Unified knowledge layer: merges memories, decisions, CoT, and artifacts into one table.

-- Unified knowledge_entries table
create table if not exists knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  kind text not null,              -- 'memory' | 'decision' | 'cot' | 'artifact'
  title text not null,
  content text not null,           -- raw content (code, docs, configs, plans, etc.)
  summary text,                    -- AI-generated summary (filled async by Gemini)
  metadata jsonb default '{}',     -- kind-specific data (rationale, reasoning_steps, file_type, etc.)
  tags text[] default '{}',
  embedding vector(768),
  created_at timestamptz not null default now()
);

create index if not exists idx_knowledge_embedding
  on knowledge_entries using ivfflat (embedding vector_cosine_ops);
create index if not exists idx_knowledge_session
  on knowledge_entries (session_id, created_at);
create index if not exists idx_knowledge_kind
  on knowledge_entries (kind, project_id);

alter table if exists knowledge_entries enable row level security;

-- Unified vector search RPC
create or replace function match_knowledge(
  query_embedding vector(768),
  filter_kinds text[] default null,
  match_threshold float default 0.5,
  match_count int default 10,
  filter_project_id uuid default null
) returns table (
  id uuid,
  kind text,
  title text,
  content text,
  summary text,
  metadata jsonb,
  tags text[],
  similarity float,
  created_at timestamptz
) language sql stable as $$
  select
    k.id, k.kind, k.title, k.content, k.summary,
    k.metadata, k.tags,
    1 - (k.embedding <=> query_embedding) as similarity,
    k.created_at
  from knowledge_entries k
  where
    (filter_project_id is null or k.project_id = filter_project_id)
    and (filter_kinds is null or k.kind = any(filter_kinds))
    and k.embedding is not null
    and 1 - (k.embedding <=> query_embedding) > match_threshold
  order by k.embedding <=> query_embedding
  limit match_count;
$$;

-- Add job_type to embedding_queue for 2-phase processing (summarize -> embed)
alter table embedding_queue add column if not exists job_type text not null default 'embedding';
-- job_type values: 'embedding' (existing behavior) or 'summarize' (new: AI summary first)
