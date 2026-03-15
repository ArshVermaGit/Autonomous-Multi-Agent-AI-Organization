-- Migration 005: Seed local data
-- Inserts default tenant and user for AUTH_DISABLED=true (Local Mode)

BEGIN;

-- Insert default tenant
INSERT INTO tenants (id, name, plan, max_projects)
VALUES ('00000000-0000-0000-0000-000000000002', 'Local Organization', 'enterprise', 99)
ON CONFLICT (id) DO NOTHING;

-- Insert default user
INSERT INTO users (id, tenant_id, email, display_name, role)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'local@localhost', 'Local Owner', 'owner')
ON CONFLICT (id) DO NOTHING;

COMMIT;
