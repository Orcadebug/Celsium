-- 001_initial_schema.sql
-- Baseline schema aligned with ForgeSync v0 plan.

create extension if not exists vector;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  repo_url text,
  created_at timestamptz not null default now()
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  provider text not null,
  api_key_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  intent text,
  summary text,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  title text not null,
  intent text,
  chosen_approach text,
  rationale text,
  alternatives jsonb,
  embedding vector(768),
  created_at timestamptz not null default now()
);

create table if not exists memory_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  type text not null,
  title text not null,
  content text not null,
  tags text[] default '{}',
  scope text,
  embedding vector(768),
  created_at timestamptz not null default now()
);

create table if not exists file_locks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  path text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  status text not null default 'open',
  claimed_by_session uuid references sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_memory_embedding on memory_entries using ivfflat (embedding vector_cosine_ops);
create index if not exists idx_decisions_embedding on decisions using ivfflat (embedding vector_cosine_ops);