-- Phase 7: media ownership and upload metadata.
ALTER TABLE "public"."Image"
  ADD COLUMN IF NOT EXISTS "mimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER,
  ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS "uploadedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Image_uploadedByUserId_fkey'
  ) THEN
    ALTER TABLE "public"."Image"
      ADD CONSTRAINT "Image_uploadedByUserId_fkey"
      FOREIGN KEY ("uploadedByUserId") REFERENCES "public"."User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Image_organizationId_fkey'
  ) THEN
    ALTER TABLE "public"."Image"
      ADD CONSTRAINT "Image_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Image_uploadedByUserId_idx" ON "public"."Image"("uploadedByUserId");
CREATE INDEX IF NOT EXISTS "Image_organizationId_idx" ON "public"."Image"("organizationId");
CREATE INDEX IF NOT EXISTS "Image_purpose_idx" ON "public"."Image"("purpose");
CREATE INDEX IF NOT EXISTS "Image_createdAt_idx" ON "public"."Image"("createdAt");
