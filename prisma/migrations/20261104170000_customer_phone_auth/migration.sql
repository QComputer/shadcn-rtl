-- Additive customer identity boundary; no existing profile phones are backfilled or merged.
CREATE TABLE "CustomerPhoneIdentity" (
  "id" TEXT NOT NULL PRIMARY KEY, "phone" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerPhoneIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerPhoneIdentity_phone_key" ON "CustomerPhoneIdentity"("phone");
CREATE UNIQUE INDEX "CustomerPhoneIdentity_userId_key" ON "CustomerPhoneIdentity"("userId");
CREATE TABLE "CustomerAccessLink" (
  "id" TEXT NOT NULL PRIMARY KEY, "tokenDigest" TEXT NOT NULL, "phone" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL, "origin" TEXT NOT NULL, "source" TEXT NOT NULL,
  "issuanceKey" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL, "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerAccessLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerAccessLink_tokenDigest_key" ON "CustomerAccessLink"("tokenDigest");
CREATE UNIQUE INDEX "CustomerAccessLink_issuanceKey_key" ON "CustomerAccessLink"("issuanceKey");
CREATE INDEX "CustomerAccessLink_expiresAt_idx" ON "CustomerAccessLink"("expiresAt");
CREATE TABLE "CustomerPhoneSession" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "organizationId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerPhoneSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerPhoneSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CustomerPhoneSession_userId_revokedAt_idx" ON "CustomerPhoneSession"("userId", "revokedAt");
CREATE INDEX "CustomerPhoneSession_expiresAt_idx" ON "CustomerPhoneSession"("expiresAt");
CREATE TABLE "CustomerAuthSmsOutbox" (
  "id" TEXT NOT NULL PRIMARY KEY, "linkId" TEXT NOT NULL, "encryptedPayload" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockedUntil" TIMESTAMP(3), "leaseId" TEXT,
  "lastErrorCode" TEXT, "sentAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerAuthSmsOutbox_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "CustomerAccessLink"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerAuthSmsOutbox_linkId_key" ON "CustomerAuthSmsOutbox"("linkId");
CREATE INDEX "CustomerAuthSmsOutbox_status_nextAttemptAt_idx" ON "CustomerAuthSmsOutbox"("status", "nextAttemptAt");
CREATE TABLE "CustomerPhoneAuthQuota" (
  "key" TEXT NOT NULL, "windowStart" TIMESTAMP(3) NOT NULL, "count" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("key", "windowStart")
);
CREATE TABLE "CustomerUssdEnrollmentRoute" (
  "id" TEXT NOT NULL PRIMARY KEY, "organizationId" TEXT NOT NULL, "publicId" TEXT NOT NULL,
  "dialPath" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT false, "smsTemplate" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerUssdEnrollmentRoute_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomerUssdEnrollmentRoute_publicId_key" ON "CustomerUssdEnrollmentRoute"("publicId");
CREATE UNIQUE INDEX "CustomerUssdEnrollmentRoute_dialPath_key" ON "CustomerUssdEnrollmentRoute"("dialPath");
CREATE INDEX "CustomerUssdEnrollmentRoute_organizationId_enabled_idx" ON "CustomerUssdEnrollmentRoute"("organizationId", "enabled");
-- Promotions are an authorization boundary even for direct supported staff workflows.
CREATE FUNCTION customer_phone_auth_revoke_on_user_privilege() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."role" <> 'CUSTOMER' OR NEW."isTeamMember" OR NOT NEW."isActive" OR NEW."deletedAt" IS NOT NULL THEN
    UPDATE "CustomerPhoneSession" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "userId" = NEW."id" AND "revokedAt" IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER customer_phone_auth_user_privilege AFTER UPDATE OF "role", "isTeamMember", "isActive", "deletedAt" ON "User"
  FOR EACH ROW EXECUTE FUNCTION customer_phone_auth_revoke_on_user_privilege();
CREATE FUNCTION customer_phone_auth_revoke_on_membership_privilege() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."isActive" AND NEW."role" IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'DRIVER') THEN
    -- Coordinate with consume's user-row lock before revocation.
    PERFORM id FROM "User" WHERE id = NEW."userId" FOR UPDATE;
    UPDATE "CustomerPhoneSession" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "userId" = NEW."userId" AND "revokedAt" IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER customer_phone_auth_membership_privilege AFTER INSERT OR UPDATE OF "role", "isActive", "userId" ON "OrganizationMember"
  FOR EACH ROW EXECUTE FUNCTION customer_phone_auth_revoke_on_membership_privilege();
