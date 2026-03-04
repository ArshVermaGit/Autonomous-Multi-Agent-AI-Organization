-- Migration 002: Per-User LLM Key Management & Agent Model Preferences
-- 
-- Changes:
--   1. user_llm_keys     → Multiple encrypted API keys per user (any provider)
--   2. agent_model_prefs → Per-user, per-agent-role model override preferences
--
-- Encryption note:
--   api_key_enc is AES-256-GCM encrypted by the Go keystore package before insert.
--   The raw API key NEVER touches the database in plaintext.
--   Decryption only happens in Go process memory at task-dispatch time.

BEGIN;

-- ── 1. User LLM Keys ──────────────────────────────────────────────────────────
-- Allows a user to store multiple API keys per provider.
-- Example: One personal OpenAI key, one work OpenAI key — both selectable from UI.
CREATE TABLE user_llm_keys (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Which LLM company this key belongs to
    provider    TEXT        NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),

    -- Human-readable label set by the user in the UI (e.g. "Personal", "Company")
    key_label   TEXT        NOT NULL DEFAULT 'default',

    -- AES-256-GCM encrypted blob. Format: [12-byte nonce][ciphertext]
    -- Never store or log the raw key anywhere outside Go process memory.
    api_key_enc BYTEA       NOT NULL,

    -- Hint showing only last 4 characters e.g. "...Xk9p" — safe to display in UI
    key_hint    TEXT,

    -- Set to false automatically if the key returns 401 from the LLM provider.
    -- Prevents retrying a dead/revoked key on every project.
    is_valid    BOOLEAN     NOT NULL DEFAULT true,

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index: fast lookup of all keys for a specific user
CREATE INDEX idx_user_llm_keys_user    ON user_llm_keys(user_id);

-- Index: fast lookup for a specific user + provider combination
CREATE INDEX idx_user_llm_keys_provider ON user_llm_keys(user_id, provider);

-- Trigger: keep updated_at fresh automatically
CREATE TRIGGER trg_user_llm_keys_updated_at
    BEFORE UPDATE ON user_llm_keys
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ── 2. Agent Model Preferences ────────────────────────────────────────────────
-- One row per (user, agent_role). Stores which provider + model + API key
-- that user wants for that specific agent role.
--
-- If no row exists for a user+role combo → Go Orchestrator uses the
-- global defaults from model_registry.py (e.g. CEO → gpt-4o).
CREATE TABLE agent_model_prefs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Must match AGENT_REGISTRY keys in agent_service.py
    agent_role  TEXT        NOT NULL CHECK (agent_role IN (
                    'CEO',
                    'CTO',
                    'Engineer_Backend',
                    'Engineer_Frontend',
                    'QA',
                    'DevOps',
                    'Finance'
                )),

    -- Which provider to use for this agent role
    provider    TEXT        NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google')),

    -- Model identifier — must be a valid model for the selected provider
    -- e.g. "gpt-4o", "claude-3-5-sonnet-latest", "gemini-2.5-pro"
    model_name  TEXT        NOT NULL,

    -- FK to the specific API key from user_llm_keys to use for this agent.
    -- NULL = use the first valid key for the selected provider.
    key_id      UUID        REFERENCES user_llm_keys(id) ON DELETE SET NULL,

    -- Extra model parameters (optional). JSON blob for temperature, max_tokens etc.
    -- Example: {"temperature": 0.2, "max_tokens": 8192}
    model_params JSONB      NOT NULL DEFAULT '{}',

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One preference row per user per agent role
    UNIQUE (user_id, agent_role)
);

-- Index: fast lookup of all agent prefs for a user (used at project dispatch)
CREATE INDEX idx_agent_model_prefs_user ON agent_model_prefs(user_id);

-- Trigger: keep updated_at fresh
CREATE TRIGGER trg_agent_model_prefs_updated_at
    BEFORE UPDATE ON agent_model_prefs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
