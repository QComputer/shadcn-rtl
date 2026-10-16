\set ON_ERROR_STOP on
\pset pager off
\pset format csv

BEGIN TRANSACTION READ ONLY;

SELECT current_database() = :'expected_database' AS database_ok,
       current_user = :'expected_role' AS effective_role_ok,
       session_user = :'expected_role' AS session_role_ok,
       current_schema() = 'public' AS schema_ok,
       (current_setting('server_version_num')::integer / 10000) = :'expected_postgres_major'::integer AS version_ok,
       current_setting('transaction_read_only') = 'on' AS read_only_ok,
       NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication AND NOT r.rolbypassrls AS role_flags_ok,
       NOT has_database_privilege(current_user, current_database(), 'CREATE') AS database_no_create_ok,
       NOT EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid) AS no_role_memberships_ok,
       NOT has_schema_privilege(current_user, 'public', 'CREATE') AS schema_no_create_ok,
       NOT EXISTS (
         SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
           AND (has_table_privilege(current_user,c.oid,'INSERT') OR has_table_privilege(current_user,c.oid,'UPDATE')
             OR has_table_privilege(current_user,c.oid,'DELETE') OR has_table_privilege(current_user,c.oid,'TRUNCATE')
             OR has_table_privilege(current_user,c.oid,'TRIGGER'))
       ) AS no_public_table_writes_ok,
       NOT EXISTS (
         SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'S'
           AND (has_sequence_privilege(current_user,c.oid,'USAGE') OR has_sequence_privilege(current_user,c.oid,'SELECT') OR has_sequence_privilege(current_user,c.oid,'UPDATE'))
       ) AS no_public_sequence_access_ok,
       NOT EXISTS (
         SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
           AND c.relname <> '_prisma_migrations'
           AND has_table_privilege(current_user,c.oid,'SELECT')
       ) AS no_public_application_data_select_ok
FROM pg_roles r WHERE r.rolname = current_user
\gset

\if :database_ok
\else
  \echo REFUSED: connected database does not match the explicitly expected database
  \quit 21
\endif
\if :effective_role_ok
\else
  \echo REFUSED: effective role mismatch
  \quit 22
\endif
\if :session_role_ok
\else
  \echo REFUSED: session role mismatch
  \quit 23
\endif
\if :schema_ok
\else
  \echo REFUSED: expected public schema is not active
  \quit 24
\endif
\if :version_ok
\else
  \echo REFUSED: PostgreSQL major version mismatch
  \quit 25
\endif
\if :read_only_ok
\else
  \echo REFUSED: transaction is not read-only
  \quit 26
\endif
\if :role_flags_ok
\else
  \echo REFUSED: role has elevated cluster/database attributes
  \quit 27
\endif
\if :database_no_create_ok
\else
  \echo REFUSED: role can create objects in the database
  \quit 28
\endif
\if :no_role_memberships_ok
\else
  \echo REFUSED: role inherits or can assume another role
  \quit 33
\endif
\if :schema_no_create_ok
\else
  \echo REFUSED: role can create objects in public schema
  \quit 29
\endif
\if :no_public_table_writes_ok
\else
  \echo REFUSED: role has write grants on public tables
  \quit 30
\endif
\if :no_public_sequence_access_ok
\else
  \echo REFUSED: role has access to public sequences
  \quit 31
\endif
\if :no_public_application_data_select_ok
\else
  \echo REFUSED: role can read public application tables beyond the migration ledger
  \quit 34
\endif

\echo SECTION: identity and read-only authority
SELECT current_database()::text AS database,
       current_user::text AS effective_role,
       session_user::text AS session_role,
       current_schema()::text AS schema,
       (current_setting('server_version_num')::integer / 10000)::integer AS postgres_major,
       current_setting('transaction_read_only')::text AS transaction_read_only;

\echo SECTION: migration ledger metadata only (migration logs and table data excluded)
SELECT migration_name::text AS migration_name, checksum::text AS checksum,
       started_at, finished_at, rolled_back_at,
       CASE WHEN finished_at IS NOT NULL AND rolled_back_at IS NULL THEN 'SUCCEEDED'
            WHEN rolled_back_at IS NOT NULL THEN 'ROLLED_BACK'
            ELSE 'INCOMPLETE' END::text AS state
FROM public._prisma_migrations
ORDER BY started_at, migration_name;

\echo SECTION: public schema column metadata
SELECT c.relname::text AS table_name, a.attname::text AS column_name,
       format_type(a.atttypid, a.atttypmod)::text AS data_type,
       t.typname::text AS udt_name, (NOT a.attnotnull) AS is_nullable
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_type t ON t.oid = a.atttypid
WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY c.relname, a.attnum;

\echo SECTION: public schema constraints
SELECT c.conrelid::regclass::text AS relation, c.conname::text AS name,
       c.contype::text AS type, pg_get_constraintdef(c.oid, true)::text AS definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = (SELECT relnamespace FROM pg_class WHERE oid = c.conrelid)
WHERE n.nspname = 'public'
ORDER BY relation, name;

\echo SECTION: public schema indexes
SELECT schemaname::text AS schema, tablename::text AS table_name,
       indexname::text AS name, indexdef::text AS definition
FROM pg_indexes WHERE schemaname = 'public'
ORDER BY tablename, indexname;

\echo SECTION: public schema enum labels
SELECT n.nspname::text AS schema, t.typname::text AS name,
       e.enumlabel::text AS label, e.enumsortorder::real AS order
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;

COMMIT;
