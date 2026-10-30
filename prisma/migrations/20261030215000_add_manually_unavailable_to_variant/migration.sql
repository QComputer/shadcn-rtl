-- Add manuallyUnavailable field to ProductVariant for independent sales availability control
ALTER TABLE "ProductVariant" ADD COLUMN "manuallyUnavailable" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ProductVariant_manuallyUnavailable_idx" ON "ProductVariant"("manuallyUnavailable");
