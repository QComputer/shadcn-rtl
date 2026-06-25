CREATE TABLE IF NOT EXISTS "CustomerSegment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "rule" JSONB,
  "isSystem" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomerSegmentRule" (
  "id" TEXT NOT NULL,
  "segmentId" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "operator" TEXT NOT NULL,
  "value" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerSegmentRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomerSegmentSnapshot" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "segmentId" TEXT,
  "segmentKey" TEXT NOT NULL,
  "memberCount" INTEGER NOT NULL,
  "rule" JSONB,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerSegmentSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerSegment_organizationId_key_key"
  ON "CustomerSegment"("organizationId", "key");

CREATE INDEX IF NOT EXISTS "CustomerSegment_organizationId_isActive_idx"
  ON "CustomerSegment"("organizationId", "isActive");

CREATE INDEX IF NOT EXISTS "CustomerSegmentRule_segmentId_idx"
  ON "CustomerSegmentRule"("segmentId");

CREATE INDEX IF NOT EXISTS "CustomerSegmentSnapshot_organizationId_segmentKey_calculatedAt_idx"
  ON "CustomerSegmentSnapshot"("organizationId", "segmentKey", "calculatedAt");

CREATE INDEX IF NOT EXISTS "CustomerSegmentSnapshot_segmentId_calculatedAt_idx"
  ON "CustomerSegmentSnapshot"("segmentId", "calculatedAt");

DO $$ BEGIN
  ALTER TABLE "CustomerSegment"
    ADD CONSTRAINT "CustomerSegment_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerSegmentRule"
    ADD CONSTRAINT "CustomerSegmentRule_segmentId_fkey"
    FOREIGN KEY ("segmentId") REFERENCES "CustomerSegment"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerSegmentSnapshot"
    ADD CONSTRAINT "CustomerSegmentSnapshot_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerSegmentSnapshot"
    ADD CONSTRAINT "CustomerSegmentSnapshot_segmentId_fkey"
    FOREIGN KEY ("segmentId") REFERENCES "CustomerSegment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
