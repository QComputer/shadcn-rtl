-- Rollback Phase BB-B2B-P10: Request-demo lead storage and admin review.

ALTER TABLE "RequestDemoLead" DROP CONSTRAINT "RequestDemoLead_reviewedById_fkey";

DROP INDEX "RequestDemoLead_status_createdAt_idx";
DROP INDEX "RequestDemoLead_source_idx";
DROP INDEX "RequestDemoLead_createdAt_idx";
DROP INDEX "RequestDemoLead_reviewedById_idx";

DROP TABLE "RequestDemoLead";

DROP TYPE "RequestDemoLeadStatus";
