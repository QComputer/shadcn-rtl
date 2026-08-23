-- Internal platform integration owner flag.
-- Keeps platform-owned provider integrations in the existing OrganizationIntegration model
-- while allowing public surfaces to exclude the internal platform owner row.

ALTER TABLE "Organization"
  ADD COLUMN "isPlatformOwner" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Organization_isPlatformOwner_idx" ON "Organization"("isPlatformOwner");
