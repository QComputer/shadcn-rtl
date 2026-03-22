-- CreateIndex
CREATE INDEX "Order_preparationProgressId_idx" ON "Order"("preparationProgressId");

-- CreateIndex
CREATE INDEX "Order_pickupProgressId_idx" ON "Order"("pickupProgressId");

-- CreateIndex
CREATE INDEX "Order_deliveryProgressId_idx" ON "Order"("deliveryProgressId");
