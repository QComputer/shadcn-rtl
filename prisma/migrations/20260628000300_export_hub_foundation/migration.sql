-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('QUEUED', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ExportJobFormat" AS ENUM ('CSV', 'JSON');

-- CreateEnum
CREATE TYPE "ExportDataType" AS ENUM ('PRODUCTS', 'PRODUCT_CATEGORIES', 'ORDERS', 'CUSTOMERS', 'FANPAGE_POSTS');

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ExportDataType" NOT NULL,
    "format" "ExportJobFormat" NOT NULL DEFAULT 'JSON',
    "status" "ExportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "fileName" TEXT,
    "mimeType" TEXT,
    "payload" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "requestedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportJob_organizationId_idx" ON "ExportJob"("organizationId");

-- CreateIndex
CREATE INDEX "ExportJob_organizationId_status_idx" ON "ExportJob"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ExportJob_organizationId_type_idx" ON "ExportJob"("organizationId", "type");

-- CreateIndex
CREATE INDEX "ExportJob_requestedByUserId_idx" ON "ExportJob"("requestedByUserId");

-- CreateIndex
CREATE INDEX "ExportJob_createdAt_idx" ON "ExportJob"("createdAt");

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
