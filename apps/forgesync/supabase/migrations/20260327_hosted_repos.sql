-- Hosted repo support: file sync metadata, CLI link sessions, and basic usage events.

alter table knowledge_entries add column if not exists source text;
alter table knowledge_entries add column if not exists source_path text;
alter table knowledge_entries add column if not exists content_hash text;
alter table knowledge_entries add column if not exists chunk_index integer default 0;
alter table knowledge_entries add column if not exists chunk_count integer default 1;

create index if not exists idx_knowledge_source_path
  on knowledge_entries (project_id, kind, source, source_path);

create table if not exists cli_link_sessions (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  callback_url text not null,
  requested_project_id uuid references projects(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  token_id uuid references api_tokens(id) on delete set null,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_cli_link_sessions_state on cli_link_sessions (state);
create index if not exists idx_cli_link_sessions_expires_at on cli_link_sessions (expires_at);

alter table cli_link_sessions enable row level security;

create table if not exists usage_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references api_tokens(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  route text not null,
  method text not null,
  ip text,
  status text not null default 'success',
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_events_user_created_at on usage_events (user_id, created_at desc);
create index if not exists idx_usage_events_project_created_at on usage_events (project_id, created_at desc);

alter table usage_events enable row level security;
