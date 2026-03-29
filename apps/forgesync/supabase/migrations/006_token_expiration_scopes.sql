-- Add expiration and scoping to API tokens
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS scopes text[] DEFAULT '{"agent:read","agent:write"}';
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS last_used_at timestamptz;

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_api_tokens_expires_at ON api_tokens(expires_at) WHERE expires_at IS NOT NULL;
