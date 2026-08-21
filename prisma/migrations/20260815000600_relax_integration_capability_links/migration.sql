-- Keep integration capability links usable for legacy tenants whose capability rows
-- have not been initialized yet, while retaining organization-scoped integration ownership.
ALTER TABLE "OrganizationIntegrationCapability"
  DROP CONSTRAINT IF EXISTS "OrganizationIntegrationCapability_organizationId_capabilityKey_fkey";

-- Generalize secret references beyond the original INOTI_DEFAULT USSD profile.
ALTER TABLE "OrganizationIntegration"
  DROP CONSTRAINT IF EXISTS "OrganizationIntegration_credentialProfileKey_safe",
  ADD CONSTRAINT "OrganizationIntegration_credentialProfileKey_safe"
    CHECK ("credentialProfileKey" IS NULL OR "credentialProfileKey" ~ '^[A-Za-z0-9_:-]{1,120}$');
