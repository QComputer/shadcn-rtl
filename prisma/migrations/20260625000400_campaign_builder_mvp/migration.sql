DO $$ BEGIN
  CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CampaignChannel" AS ENUM ('IN_APP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CampaignDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Campaign" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "title" TEXT NOT NULL,
  "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CampaignAudience" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "segmentId" TEXT,
  "segmentSnapshotId" TEXT,
  "segmentKey" TEXT NOT NULL,
  "memberCount" INTEGER NOT NULL DEFAULT 0,
  "rule" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CampaignAudience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CampaignMessage" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "channel" "CampaignChannel" NOT NULL DEFAULT 'IN_APP',
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CampaignMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CampaignDelivery" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "messageId" TEXT,
  "organizationId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "notificationId" TEXT,
  "channel" "CampaignChannel" NOT NULL DEFAULT 'IN_APP',
  "status" "CampaignDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CampaignDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Campaign_organizationId_status_createdAt_idx"
  ON "Campaign"("organizationId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Campaign_createdByUserId_idx"
  ON "Campaign"("createdByUserId");

CREATE INDEX IF NOT EXISTS "CampaignAudience_campaignId_idx"
  ON "CampaignAudience"("campaignId");

CREATE INDEX IF NOT EXISTS "CampaignAudience_segmentId_idx"
  ON "CampaignAudience"("segmentId");

CREATE INDEX IF NOT EXISTS "CampaignAudience_segmentSnapshotId_idx"
  ON "CampaignAudience"("segmentSnapshotId");

CREATE INDEX IF NOT EXISTS "CampaignAudience_segmentKey_idx"
  ON "CampaignAudience"("segmentKey");

CREATE INDEX IF NOT EXISTS "CampaignMessage_campaignId_channel_idx"
  ON "CampaignMessage"("campaignId", "channel");

CREATE UNIQUE INDEX IF NOT EXISTS "CampaignDelivery_campaignId_targetUserId_channel_key"
  ON "CampaignDelivery"("campaignId", "targetUserId", "channel");

CREATE INDEX IF NOT EXISTS "CampaignDelivery_organizationId_status_createdAt_idx"
  ON "CampaignDelivery"("organizationId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "CampaignDelivery_messageId_idx"
  ON "CampaignDelivery"("messageId");

CREATE INDEX IF NOT EXISTS "CampaignDelivery_notificationId_idx"
  ON "CampaignDelivery"("notificationId");

CREATE INDEX IF NOT EXISTS "CampaignDelivery_targetUserId_idx"
  ON "CampaignDelivery"("targetUserId");

DO $$ BEGIN
  ALTER TABLE "Campaign"
    ADD CONSTRAINT "Campaign_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Campaign"
    ADD CONSTRAINT "Campaign_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignAudience"
    ADD CONSTRAINT "CampaignAudience_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignAudience"
    ADD CONSTRAINT "CampaignAudience_segmentId_fkey"
    FOREIGN KEY ("segmentId") REFERENCES "CustomerSegment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignAudience"
    ADD CONSTRAINT "CampaignAudience_segmentSnapshotId_fkey"
    FOREIGN KEY ("segmentSnapshotId") REFERENCES "CustomerSegmentSnapshot"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignMessage"
    ADD CONSTRAINT "CampaignMessage_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignDelivery"
    ADD CONSTRAINT "CampaignDelivery_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignDelivery"
    ADD CONSTRAINT "CampaignDelivery_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "CampaignMessage"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignDelivery"
    ADD CONSTRAINT "CampaignDelivery_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignDelivery"
    ADD CONSTRAINT "CampaignDelivery_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CampaignDelivery"
    ADD CONSTRAINT "CampaignDelivery_notificationId_fkey"
    FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
