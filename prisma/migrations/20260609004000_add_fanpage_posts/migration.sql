CREATE TABLE IF NOT EXISTS "FanpagePost" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "title" TEXT,
  "body" TEXT NOT NULL,
  "image" TEXT,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "FanpagePost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FanpagePost_organizationId_isPublished_deletedAt_createdAt_idx"
  ON "FanpagePost"("organizationId", "isPublished", "deletedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "FanpagePost_authorId_idx"
  ON "FanpagePost"("authorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FanpagePost_organizationId_fkey'
  ) THEN
    ALTER TABLE "FanpagePost"
      ADD CONSTRAINT "FanpagePost_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FanpagePost_authorId_fkey'
  ) THEN
    ALTER TABLE "FanpagePost"
      ADD CONSTRAINT "FanpagePost_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
