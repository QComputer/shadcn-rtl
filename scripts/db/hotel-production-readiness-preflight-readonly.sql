-- BazarBaaz Hotel Production readiness snapshot.
-- Run with a restricted read-only PostgreSQL role and save output securely.
-- No DDL/DML, ledger repair, schema creation, or data mutation is performed.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT current_database() AS database_name, current_user AS role_name,
       current_setting('transaction_read_only') AS transaction_read_only,
       version() AS server_version;

-- Exact Prisma ledger state. Do not edit any row based on this report alone.
SELECT migration_name, checksum, started_at, finished_at, rolled_back_at,
       applied_steps_count
FROM "_prisma_migrations"
ORDER BY started_at, migration_name;

-- Hotel operational objects touched by the five known pending migrations.
SELECT n.nspname AS schema_name, c.relkind AS object_kind, c.relname AS object_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'HotelProperty', 'HotelReservation', 'HotelStayQuote', 'HotelStayRequest',
    'HotelOfflinePayment', 'HotelOfflinePaymentCommandIdempotency',
    'HotelOfflinePaymentAuditEvent'
  )
ORDER BY c.relname;

SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('HotelProperty', 'HotelReservation', 'HotelOfflinePayment')
ORDER BY table_name, ordinal_position;

SELECT t.typname AS enum_name, e.enumlabel AS enum_value, e.enumsortorder
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
  AND t.typname IN (
    'HotelOperationalMode', 'HotelStayRequestStatus', 'HotelOfflinePaymentMethod',
    'HotelOfflinePaymentStatus', 'HotelOfflinePaymentCommandType',
    'HotelManualConfirmationPolicy', 'HotelOfflinePaymentAuditEventType'
  )
ORDER BY t.typname, e.enumsortorder;

-- The client/operator must separately verify backup/PITR availability and a
-- restore test in the hosting provider. PostgreSQL catalogs cannot prove that.
ROLLBACK;
