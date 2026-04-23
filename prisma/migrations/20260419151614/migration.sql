-- DropIndex
DROP INDEX "OrganizationMember_organizationSlug_userId_key";

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationSlug_userId_idx" ON "OrganizationMember"("organizationSlug", "userId");
