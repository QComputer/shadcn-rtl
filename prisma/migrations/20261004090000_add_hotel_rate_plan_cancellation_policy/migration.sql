-- H3-C2: optional, same-property cancellation-policy association.
-- Existing rate plans remain unassigned and retain legacy behavior.
ALTER TABLE "HotelRatePlan" ADD COLUMN "cancellationPolicyId" TEXT;
CREATE UNIQUE INDEX "HotelCancellationPolicy_id_propertyId_organizationId_key" ON "HotelCancellationPolicy"("id", "propertyId", "organizationId");
ALTER TABLE "HotelRatePlan" ADD CONSTRAINT "HotelRatePlan_cancellationPolicyId_propertyId_organizationId_fkey" FOREIGN KEY ("cancellationPolicyId", "propertyId", "organizationId") REFERENCES "HotelCancellationPolicy"("id", "propertyId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
