BEGIN;

-- The existing acquisition record is the durable bootstrap receipt. This
-- partial index protects the workflow key without constraining other flows.
CREATE UNIQUE INDEX "OrganizationAcquisition_secure_hotel_bootstrap_key"
  ON "OrganizationAcquisition" (("metadata"->>'key'))
  WHERE "metadata"->>'workflow' = 'SECURE_HOTEL_BOOTSTRAP_V1';

-- Legacy invitations remain unbound and are intentionally not redeemable by
-- the recipient-verified activation endpoint. No existing user is promoted.
ALTER TABLE "OrganizationInvitation"
  ADD COLUMN "recipientUserId" TEXT,
  ADD COLUMN "recipientEmail" TEXT,
  ADD COLUMN "recipientUsername" TEXT,
  ADD COLUMN "issuanceKey" TEXT,
  ADD COLUMN "requestSha256" TEXT;

CREATE UNIQUE INDEX "OrganizationInvitation_issuanceKey_key" ON "OrganizationInvitation"("issuanceKey");
CREATE INDEX "OrganizationInvitation_recipientUserId_status_idx" ON "OrganizationInvitation"("recipientUserId", "status");
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_bound_identity_check" CHECK (
  ("recipientUserId" IS NULL AND "recipientEmail" IS NULL AND "recipientUsername" IS NULL AND "issuanceKey" IS NULL AND "requestSha256" IS NULL)
  OR
  ("recipientUserId" IS NOT NULL AND "recipientEmail" IS NOT NULL AND "recipientUsername" IS NOT NULL
   AND "issuanceKey" IS NOT NULL AND "requestSha256" IS NOT NULL AND "createdByUserId" IS NOT NULL
   AND "recipientEmail" = lower("recipientEmail") AND length("recipientEmail") BETWEEN 3 AND 254
   AND "recipientUsername" ~ '^[a-z0-9][a-z0-9-]{2,63}$'
   AND "issuanceKey" ~ '^[A-Za-z0-9_-]{8,128}$' AND "requestSha256" ~ '^[a-f0-9]{64}$'
   AND "invitedRole" IN ('ADMIN', 'MANAGER')
   AND (("status" = 'CLAIMED' AND "claimedByUserId" IS NOT NULL AND "claimedByUserId" = "recipientUserId")
        OR ("status" <> 'CLAIMED' AND "claimedByUserId" IS NULL)))
);

CREATE FUNCTION "guard_bound_organization_invitation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."recipientUserId" IS NOT NULL THEN
    IF ROW(NEW."organizationId", NEW."invitedRole", NEW."tokenHash", NEW."expiresAt", NEW."createdByUserId",
           NEW."recipientUserId", NEW."recipientEmail", NEW."recipientUsername", NEW."issuanceKey", NEW."requestSha256")
       IS DISTINCT FROM
       ROW(OLD."organizationId", OLD."invitedRole", OLD."tokenHash", OLD."expiresAt", OLD."createdByUserId",
           OLD."recipientUserId", OLD."recipientEmail", OLD."recipientUsername", OLD."issuanceKey", OLD."requestSha256") THEN
      RAISE EXCEPTION 'Bound invitation identity is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD."status" IN ('CLAIMED', 'REVOKED') AND ROW(NEW."status", NEW."claimedByUserId") IS DISTINCT FROM ROW(OLD."status", OLD."claimedByUserId") THEN
      RAISE EXCEPTION 'Terminal invitation state is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "OrganizationInvitation_bound_guard" BEFORE UPDATE ON "OrganizationInvitation"
  FOR EACH ROW EXECUTE FUNCTION "guard_bound_organization_invitation"();

COMMIT;
