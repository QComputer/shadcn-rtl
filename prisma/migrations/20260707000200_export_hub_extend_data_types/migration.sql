-- BB-B2B-P10-FIX1: extend ExportDataType to match existing export-hub implementation.
-- Adds CUSTOMERS and FANPAGE_POSTS to the ExportDataType enum.
-- No table data changes; existingExportJob rows are unaffected.
-- Made idempotent: 20260628000300_export_hub_foundation already created the
-- enum with these labels, so guard against "already exists" (42710) on a clean
-- migrate deploy.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ExportDataType' AND e.enumlabel = 'CUSTOMERS'
  ) THEN
    ALTER TYPE "ExportDataType" ADD VALUE 'CUSTOMERS';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ExportDataType' AND e.enumlabel = 'FANPAGE_POSTS'
  ) THEN
    ALTER TYPE "ExportDataType" ADD VALUE 'FANPAGE_POSTS';
  END IF;
END $$;
