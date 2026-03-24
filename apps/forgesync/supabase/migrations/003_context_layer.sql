-- 003_context_layer.sql
-- Adds Project DNA, Chain-of-Thought traces, and embedding queue.

-- Layer 1: Project DNA (JSONB on projects)
alter table projects add column if not exists dna jsonb default '{}';

-- Layer 3: Chain-of-Thought traces
create table if not exists cot_traces (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  decision_id uuid references decisions(id) on delete set null,
  reasoning_steps jsonb not null,
  conclusion text,
  tags text[] default '{}',
  embedding vector(768),
  created_at timestamptz not null default now()
);

create index if not exists idx_cot_embedding
  on cot_traces using ivfflat (embedding vector_cosine_ops);

alter table if exists cot_traces enable row level security;

-- Embedding queue (persistent background processing)
create table if not exists embedding_queue (
  id uuid primary key default gen_random_uuid(),
  target_table text not null,
  target_id uuid not null,
  text_to_embed text not null,
  status text not null default 'pending',
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_embedding_queue_pending
  on embedding_queue (status, created_at)
  where status = 'pending';

alter table if exists embedding_queue enable row level security;

-- Vector search RPC: match memories by cosine similarity
create or replace function match_memories(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 10,
  filter_project_id uuid default null
) returns table (
  id uuid,
  title text,
  content text,
  type text,
  tags text[],
  similarity float
) language sql stable as $$
  select
    m.id, m.title, m.content, m.type, m.tags,
    1 - (m.embedding <=> query_embedding) as similarity
  from memory_entries m
  where
    (filter_project_id is null or m.project_id = filter_project_id)
    and m.embedding is not null
    and 1 - (m.embedding <=> query_embedding) > match_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

-- Vector search RPC: match decisions by cosine similarity
create or replace function match_decisions(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 10,
  filter_project_id uuid default null
) returns table (
  id uuid,
  title text,
  chosen_approach text,
  rationale text,
  similarity float
) language sql stable as $$
  select
    d.id, d.title, d.chosen_approach, d.rationale,
    1 - (d.embedding <=> query_embedding) as similarity
  from decisions d
  where
    (filter_project_id is null or d.project_id = filter_project_id)
    and d.embedding is not null
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- Vector search RPC: match CoT traces by cosine similarity
create or replace function match_cot_traces(
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 10,
  filter_project_id uuid default null
) returns table (
  id uuid,
  reasoning_steps jsonb,
  conclusion text,
  tags text[],
  similarity float
) language sql stable as $$
  select
    c.id, c.reasoning_steps, c.conclusion, c.tags,
    1 - (c.embedding <=> query_embedding) as similarity
  from cot_traces c
  where
    (filter_project_id is null or c.project_id = filter_project_id)
    and c.embedding is not null
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
