BEGIN;
ALTER TABLE "TenantProvisioningPlan"
 ADD COLUMN "executionConfiguration" JSONB,
 ADD COLUMN "approvedExecutionSnapshot" JSONB,
 ADD COLUMN "approvedExecutionSha256" TEXT,
 ADD COLUMN "executionReceipt" JSONB,
 ADD COLUMN "executedAt" TIMESTAMP(3);
ALTER TABLE "TenantProvisioningPlan" ADD CONSTRAINT "TenantProvisioningPlan_execution_sha_check"
 CHECK ("approvedExecutionSha256" IS NULL OR "approvedExecutionSha256" ~ '^[a-f0-9]{64}$');
CREATE UNIQUE INDEX "TenantProvisioningPlan_execution_key" ON "TenantProvisioningPlan" (("executionReceipt"->>'key')) WHERE "executionReceipt" IS NOT NULL;
CREATE UNIQUE INDEX "TenantProvisioningPlan_execution_organization" ON "TenantProvisioningPlan" (("executionReceipt"->>'organizationId')) WHERE "executionReceipt" IS NOT NULL;
CREATE UNIQUE INDEX "OrganizationAcquisition_universal_key" ON "OrganizationAcquisition" (("metadata"->>'key')) WHERE "metadata"->>'workflow'='UNIVERSAL_PROVISIONING_V1';
CREATE FUNCTION guard_universal_provisioning_plan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."executionReceipt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION 'Completed provisioning plans are immutable';
 END IF;
 IF OLD.status='APPROVED' AND OLD."executionConfiguration" IS NOT NULL THEN
   IF NEW."executionConfiguration" IS DISTINCT FROM OLD."executionConfiguration"
      OR NEW."approvedExecutionSnapshot" IS DISTINCT FROM OLD."approvedExecutionSnapshot"
      OR NEW."approvedExecutionSha256" IS DISTINCT FROM OLD."approvedExecutionSha256"
      OR NEW."proposedName" IS DISTINCT FROM OLD."proposedName"
      OR NEW."proposedSlug" IS DISTINCT FROM OLD."proposedSlug"
      OR NEW."proposedOrganizationType" IS DISTINCT FROM OLD."proposedOrganizationType"
      OR NEW."proposedDefaultLocale" IS DISTINCT FROM OLD."proposedDefaultLocale"
      OR NEW.status NOT IN ('APPROVED','COMPLETED') THEN
     RAISE EXCEPTION 'Approved execution input is immutable';
   END IF;
 END IF;
 IF NEW."executionConfiguration" IS NOT NULL AND NEW.status='COMPLETED' AND
   (NEW."executionReceipt" IS NULL OR NEW."executedAt" IS NULL OR NEW."approvedExecutionSha256" IS NULL) THEN
   RAISE EXCEPTION 'Completed provisioning requires an atomic execution receipt';
 END IF;
 IF NEW."executionConfiguration" IS NOT NULL AND NEW.status='APPROVED' AND
   (NEW."approvedExecutionSnapshot" IS NULL OR NEW."approvedExecutionSha256" IS NULL) THEN
   RAISE EXCEPTION 'Approval requires a bound execution snapshot';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "TenantProvisioningPlan_execution_guard" BEFORE UPDATE ON "TenantProvisioningPlan"
 FOR EACH ROW EXECUTE FUNCTION guard_universal_provisioning_plan();
COMMIT;
