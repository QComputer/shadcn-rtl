/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,sessionId]` on the table `ShopCart` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "ShopCart_organizationId_sessionId_idx" ON "ShopCart"("organizationId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopCart_organizationId_sessionId_key" ON "ShopCart"("organizationId", "sessionId");
