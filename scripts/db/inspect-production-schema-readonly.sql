-- Read-only production schema inspection script for BazarBaaz customer-auth release.
-- Run with a restricted read-only role. Does not modify data.
SET statement_timeout = '30s';
SELECT version();
SELECT current_database(), current_user;
SELECT migration_name, finished_at, applied_steps_count, rolled_back_at
FROM "_prisma_migrations" ORDER BY started_at;
-- Table existence checks (customer auth / SSO / SMS)
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN ('CustomerIdentity','CustomerSsoTicket','CustomerAuthSmsOutbox','CustomerAuthSmsAttempt');
EOF