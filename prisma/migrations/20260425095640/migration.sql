-- CreateTable
CREATE TABLE "PaymentSettings" (
    "id" TEXT NOT NULL,
    "organizationSlug" TEXT NOT NULL,
    "settings" JSONB,
    "paymentCondition" BOOLEAN DEFAULT false,
    "paymentMethodInt" INTEGER DEFAULT 0,
    "cardNumber" TEXT,

    CONSTRAINT "PaymentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSettings_organizationSlug_key" ON "PaymentSettings"("organizationSlug");

-- CreateIndex
CREATE INDEX "PaymentSettings_organizationSlug_idx" ON "PaymentSettings"("organizationSlug");

-- AddForeignKey
ALTER TABLE "PaymentSettings" ADD CONSTRAINT "PaymentSettings_organizationSlug_fkey" FOREIGN KEY ("organizationSlug") REFERENCES "Organization"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
