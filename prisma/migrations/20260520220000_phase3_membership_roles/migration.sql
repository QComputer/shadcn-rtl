-- Phase 3: organization-scoped membership roles and multi-organization membership groundwork

ALTER TABLE "public"."OrganizationMember"
  ADD COLUMN IF NOT EXISTS "role" "public"."UserRole" NOT NULL DEFAULT 'STAFF';

UPDATE "public"."OrganizationMember" om
SET "role" = CASE
  WHEN u."role" IN ('ADMIN', 'MANAGER', 'STAFF', 'DRIVER', 'CUSTOMER') THEN u."role"
  ELSE 'STAFF'::"public"."UserRole"
END
FROM "public"."User" u
WHERE u."id" = om."userId";

ALTER TABLE "public"."OrganizationMember"
  DROP CONSTRAINT IF EXISTS "OrganizationMember_userId_key";

CREATE INDEX IF NOT EXISTS "OrganizationMember_userId_organizationId_idx"
  ON "public"."OrganizationMember"("userId", "organizationId");
