-- BB-B2B-P10-FIX1: extend ExportDataType to match existing export-hub implementation.
-- Adds CUSTOMERS and FANPAGE_POSTS to the ExportDataType enum.
-- No table data changes; existingExportJob rows are unaffected.

ALTER TYPE "ExportDataType" ADD VALUE 'CUSTOMERS';
ALTER TYPE "ExportDataType" ADD VALUE 'FANPAGE_POSTS';
