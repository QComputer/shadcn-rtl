-- Organization-owned immutable private drafts. No publication or storefront pointer.
CREATE TABLE "TenantWebsiteRevision" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "createdBy" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantWebsiteRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantWebsiteRevision_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TenantWebsiteRevision_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TenantWebsiteRevision_organizationId_requestId_key" ON "TenantWebsiteRevision"("organizationId", "requestId");
CREATE INDEX "TenantWebsiteRevision_organizationId_createdAt_id_idx" ON "TenantWebsiteRevision"("organizationId", "createdAt" DESC, "id" DESC);
