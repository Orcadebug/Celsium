-- 002_enable_rls.sql
-- Security hardening: enforce RLS on all app tables.

alter table if exists projects enable row level security;
alter table if exists agents enable row level security;
alter table if exists sessions enable row level security;
alter table if exists decisions enable row level security;
alter table if exists memory_entries enable row level security;
alter table if exists file_locks enable row level security;
alter table if exists tasks enable row level security;

-- Note: no public/authenticated policies are created in this migration.
-- Access should be granted deliberately via service role or explicit policies.
