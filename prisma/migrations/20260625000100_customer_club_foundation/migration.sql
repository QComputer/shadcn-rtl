DO $$ BEGIN
  CREATE TYPE "CustomerClubMembershipStatus" AS ENUM ('ACTIVE', 'PAUSED', 'LEFT', 'BLOCKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CustomerClubTier" AS ENUM ('MEMBER', 'LOYAL', 'VIP');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CustomerClubJoinSource" AS ENUM ('PUBLIC_SHOP', 'CHECKOUT', 'ADMIN_IMPORT', 'CAMPAIGN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "CustomerClubMembership" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "status" "CustomerClubMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "tier" "CustomerClubTier" NOT NULL DEFAULT 'MEMBER',
  "source" "CustomerClubJoinSource" NOT NULL DEFAULT 'PUBLIC_SHOP',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerClubMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerClubMembership_organizationId_customerId_key"
  ON "CustomerClubMembership"("organizationId", "customerId");

CREATE INDEX IF NOT EXISTS "CustomerClubMembership_organizationId_status_idx"
  ON "CustomerClubMembership"("organizationId", "status");

CREATE INDEX IF NOT EXISTS "CustomerClubMembership_customerId_status_idx"
  ON "CustomerClubMembership"("customerId", "status");

DO $$ BEGIN
  ALTER TABLE "CustomerClubMembership"
    ADD CONSTRAINT "CustomerClubMembership_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerClubMembership"
    ADD CONSTRAINT "CustomerClubMembership_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
