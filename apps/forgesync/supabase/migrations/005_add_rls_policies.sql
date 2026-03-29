-- 005_add_rls_policies.sql
-- Add Row-Level Security policies to all core ForgeSync tables.
--
-- Security model:
--   ForgeSync uses a backend-first architecture. All client requests hit
--   Next.js API routes which authenticate via the x-forgesync-token header
--   (checked in _shared.ts `requireAgentAuth`). The API routes then talk to
--   Supabase using the SERVICE_ROLE key, which bypasses RLS by default.
--
--   Because of this, the RLS policies here serve as a defence-in-depth layer:
--     - service_role: full CRUD (Supabase service role bypasses RLS anyway,
--       but explicit policies make the intent clear and survive config changes).
--     - anon / authenticated: blocked entirely. No direct Supabase client
--       access is permitted for core tables; all access must go through the API.
--
--   The api_tokens table is bootstrapped here because it needs to exist before
--   later auth and hosted-repo migrations, and the legacy short-number
--   migration sequence does not allow inserting a new standalone migration
--   cleanly between 004 and 005.
--
-- Idempotency:
--   PostgreSQL does not support IF NOT EXISTS for CREATE POLICY. We use
--   DROP POLICY IF EXISTS before each CREATE to make this migration safely
--   re-runnable.

-- ---------------------------------------------------------------------------
-- Helper: list of core tables that need service-role-only policies.
-- (api_tokens is excluded -- it already has user-scoped policies.)
-- ---------------------------------------------------------------------------

DO $$ BEGIN RAISE NOTICE 'Applying service-role RLS policies to core tables...'; END $$;

-- ========================== api_tokens bootstrap ============================

create table if not exists api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id uuid references projects(id) on delete cascade not null,
  token_hash text not null unique,
  name text not null default 'default',
  created_at timestamptz not null default now()
);

create index if not exists idx_api_tokens_hash on api_tokens (token_hash);
create index if not exists idx_api_tokens_user on api_tokens (user_id);

alter table projects add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table api_tokens enable row level security;

DROP POLICY IF EXISTS "Users can view their own tokens" ON api_tokens;
CREATE POLICY "Users can view their own tokens"
  ON api_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own tokens" ON api_tokens;
CREATE POLICY "Users can create their own tokens"
  ON api_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tokens" ON api_tokens;
CREATE POLICY "Users can delete their own tokens"
  ON api_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- ========================== projects =======================================

DROP POLICY IF EXISTS "service_role_all" ON projects;
CREATE POLICY "service_role_all"
  ON projects
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "deny_anon" ON projects;
CREATE POLICY "deny_anon"
  ON projects
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_authenticated" ON projects;
CREATE POLICY "deny_authenticated"
  ON projects
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ========================== agents =========================================

DROP POLICY IF EXISTS "service_role_all" ON agents;
CREATE POLICY "service_role_all"
  ON agents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "deny_anon" ON agents;
CREATE POLICY "deny_anon"
  ON agents
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_authenticated" ON agents;
CREATE POLICY "deny_authenticated"
  ON agents
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ========================== sessions =======================================

DROP POLICY IF EXISTS "service_role_all" ON sessions;
CREATE POLICY "service_role_all"
  ON sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "deny_anon" ON sessions;
CREATE POLICY "deny_anon"
  ON sessions
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_authenticated" ON sessions;
CREATE POLICY "deny_authenticated"
  ON sessions
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ========================== decisions ======================================

DROP POLICY IF EXISTS "service_role_all" ON decisions;
CREATE POLICY "service_role_all"
  ON decisions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "deny_anon" ON decisions;
CREATE POLICY "deny_anon"
  ON decisions
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_authenticated" ON decisions;
CREATE POLICY "deny_authenticated"
  ON decisions
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ========================== memory_entries =================================

DROP POLICY IF EXISTS "service_role_all" ON memory_entries;
CREATE POLICY "service_role_all"
  ON memory_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "deny_anon" ON memory_entries;
CREATE POLICY "deny_anon"
  ON memory_entries
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_authenticated" ON memory_entries;
CREATE POLICY "deny_authenticated"
  ON memory_entries
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ========================== file_locks =====================================

DROP POLICY IF EXISTS "service_role_all" ON file_locks;
CREATE POLICY "service_role_all"
  ON file_locks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "deny_anon" ON file_locks;
CREATE POLICY "deny_anon"
  ON file_locks
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_authenticated" ON file_locks;
CREATE POLICY "deny_authenticated"
  ON file_locks
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ========================== tasks ==========================================

DROP POLICY IF EXISTS "service_role_all" ON tasks;
CREATE POLICY "service_role_all"
  ON tasks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "deny_anon" ON tasks;
CREATE POLICY "deny_anon"
  ON tasks
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_authenticated" ON tasks;
CREATE POLICY "deny_authenticated"
  ON tasks
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ========================== knowledge_entries ==============================

DROP POLICY IF EXISTS "service_role_all" ON knowledge_entries;
CREATE POLICY "service_role_all"
  ON knowledge_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "deny_anon" ON knowledge_entries;
CREATE POLICY "deny_anon"
  ON knowledge_entries
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_authenticated" ON knowledge_entries;
CREATE POLICY "deny_authenticated"
  ON knowledge_entries
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ========================== cot_traces =====================================

DROP POLICY IF EXISTS "service_role_all" ON cot_traces;
CREATE POLICY "service_role_all"
  ON cot_traces
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "deny_anon" ON cot_traces;
CREATE POLICY "deny_anon"
  ON cot_traces
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_authenticated" ON cot_traces;
CREATE POLICY "deny_authenticated"
  ON cot_traces
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ========================== embedding_queue ================================

DROP POLICY IF EXISTS "service_role_all" ON embedding_queue;
CREATE POLICY "service_role_all"
  ON embedding_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "deny_anon" ON embedding_queue;
CREATE POLICY "deny_anon"
  ON embedding_queue
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_authenticated" ON embedding_queue;
CREATE POLICY "deny_authenticated"
  ON embedding_queue
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ========================== api_tokens (skip) ==============================
-- The api_tokens table already has user-scoped RLS policies defined above:
--   - "Users can view their own tokens"   (SELECT where auth.uid() = user_id)
--   - "Users can create their own tokens"  (INSERT where auth.uid() = user_id)
--   - "Users can delete their own tokens"  (DELETE where auth.uid() = user_id)
--
-- We add a service_role policy so the backend can manage tokens on behalf of
-- users, but leave the existing authenticated policies untouched.

DROP POLICY IF EXISTS "service_role_all" ON api_tokens;
CREATE POLICY "service_role_all"
  ON api_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "deny_anon" ON api_tokens;
CREATE POLICY "deny_anon"
  ON api_tokens
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE 'RLS policies applied successfully.'; END $$;
