-- H3-D3-P additive publication approvals.
-- Prepared for review only; do not apply without separate database authorization.
CREATE TABLE "HotelPublicationApproval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceRevision" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "approvedByUserId" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revokedReason" TEXT,
    CONSTRAINT "HotelPublicationApproval_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HotelPublicationApproval_scope_revision_key"
ON "HotelPublicationApproval"("organizationId", "propertyId", "resourceType", "resourceId", "resourceRevision");
CREATE INDEX "HotelPublicationApproval_scope_status_idx"
ON "HotelPublicationApproval"("organizationId", "propertyId", "resourceType", "resourceId", "status");
