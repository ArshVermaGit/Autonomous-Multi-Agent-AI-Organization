-- Rollback Migration 002
-- Drops agent_model_prefs first (it has FK to user_llm_keys)
-- then drops user_llm_keys.

BEGIN;

DROP TABLE IF EXISTS agent_model_prefs CASCADE;
DROP TABLE IF EXISTS user_llm_keys CASCADE;

COMMIT;
