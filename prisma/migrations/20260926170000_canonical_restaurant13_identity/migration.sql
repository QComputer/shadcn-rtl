-- Canonical Restaurant 13 identity migration.
-- This is intentionally additive and preserves the Organization row and every
-- organizationId. Several legacy tables persist organizationSlug as part of a
-- foreign key, so the constraints are temporarily removed while the slug is
-- changed and then recreated from PostgreSQL's original definitions.
BEGIN;

-- Fail before touching any dependent rows if the target slug is already in
-- use. A second execution with only the target slug is a safe no-op.
DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM "Organization" WHERE slug = 'fastfood13')
     AND EXISTS (SELECT 1 FROM "Organization" WHERE slug = 'italiano-13') THEN
    RAISE EXCEPTION 'Cannot migrate Restaurant 13: fastfood13 is already used by another organization';
  END IF;
END
$preflight$;

CREATE TEMP TABLE _restaurant13_slug_foreign_keys ON COMMIT DROP AS
SELECT
  c.oid AS constraint_oid,
  c.conname,
  c.conrelid::regclass AS child_table,
  pg_get_constraintdef(c.oid) AS constraint_definition,
  child_att.attname AS child_column
FROM pg_constraint c
JOIN pg_attribute parent_att
  ON parent_att.attrelid = c.confrelid
JOIN generate_subscripts(c.confkey, 1) AS fk_position(position)
  ON parent_att.attnum = c.confkey[fk_position.position]
JOIN pg_attribute child_att
  ON child_att.attrelid = c.conrelid
 AND child_att.attnum = c.conkey[fk_position.position]
WHERE c.contype = 'f'
  AND c.confrelid = '"Organization"'::regclass
  AND parent_att.attname = 'slug';

DO $drop$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN SELECT child_table, conname FROM _restaurant13_slug_foreign_keys LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.child_table, fk.conname);
  END LOOP;
END
$drop$;

-- Update every persisted organizationSlug column, including columns whose
-- relation is not represented by Prisma as a foreign key.
DO $refs$
DECLARE
  ref RECORD;
BEGIN
  FOR ref IN
    SELECT DISTINCT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE column_name = 'organizationSlug'
      AND table_schema = 'public'
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = $1 WHERE %I = $2',
      ref.table_schema, ref.table_name, ref.column_name, ref.column_name
    ) USING 'fastfood13', 'italiano-13';
  END LOOP;
END
$refs$;

DO $organization$
BEGIN
  IF EXISTS (SELECT 1 FROM "Organization" WHERE slug = 'fastfood13')
     AND NOT EXISTS (SELECT 1 FROM "Organization" WHERE slug = 'italiano-13') THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Organization" WHERE slug = 'italiano-13') THEN
    RAISE EXCEPTION 'Restaurant 13 organization with slug italiano-13 was not found';
  END IF;

  IF EXISTS (SELECT 1 FROM "Organization" WHERE slug = 'fastfood13') THEN
    RAISE EXCEPTION 'Cannot migrate Restaurant 13: fastfood13 is already used by another organization';
  END IF;

  UPDATE "Organization" SET slug = 'fastfood13' WHERE slug = 'italiano-13';
END
$organization$;

DO $restore$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN SELECT child_table, conname, constraint_definition FROM _restaurant13_slug_foreign_keys LOOP
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I %s',
      fk.child_table, fk.conname, fk.constraint_definition
    );
  END LOOP;
END
$restore$;

COMMIT;
