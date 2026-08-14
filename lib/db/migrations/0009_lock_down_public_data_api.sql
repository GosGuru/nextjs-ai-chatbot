-- Custom SQL migration file, put you code below! --
-- This migration intentionally leaves app tables in `public` for compatibility
-- with the existing Drizzle schema while making them inaccessible to PostgREST
-- roles. Runtime traffic uses the server-side PostgreSQL connection.

-- Supabase defines these PostgREST roles. Plain PostgreSQL environments used
-- by CI do not, so guard each revoke without weakening Supabase production.
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM %I',
        role_name
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON SCHEMA public FROM %I',
        role_name
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM %I',
        role_name
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM %I',
        role_name
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON FUNCTIONS FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END
$$;

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Chat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message_v2" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vote_v2" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Suggestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Stream" ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_feedback ENABLE ROW LEVEL SECURITY;
