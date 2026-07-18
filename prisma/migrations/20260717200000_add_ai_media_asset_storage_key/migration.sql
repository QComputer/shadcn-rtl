-- Add storageKey column to AiMediaAsset
-- This stores the actual app-owned storage key so content can be served
-- through the application storage gateway without relying on the hash.

ALTER TABLE "AiMediaAsset" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;

-- Populate storageKey from existing data where possible.
-- For existing records, storageKeyFingerprint is the SHA-256 of the key,
-- so we cannot reverse it. New records will store both fields.

-- Index for potential future lookups by storage key.
CREATE INDEX IF NOT EXISTS "AiMediaAsset_storageKey_idx" ON "AiMediaAsset"("storageKey");
