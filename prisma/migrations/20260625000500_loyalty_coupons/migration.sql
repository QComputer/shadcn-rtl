DO $$ BEGIN
  CREATE TYPE "LoyaltyLedgerType" AS ENUM ('EARN', 'REDEEM', 'ADJUST', 'EXPIRE', 'REFUND');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "LoyaltyLedger" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "orderId" TEXT,
  "type" "LoyaltyLedgerType" NOT NULL,
  "points" INTEGER NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoyaltyLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LoyaltyRule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "spendAmount" DECIMAL(65,30) NOT NULL DEFAULT 100000,
  "pointsAwarded" INTEGER NOT NULL DEFAULT 1,
  "pointsPerOrder" INTEGER NOT NULL DEFAULT 0,
  "minOrderTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LoyaltyRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Coupon" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "discountType" "CouponDiscountType" NOT NULL,
  "discountValue" DECIMAL(65,30) NOT NULL,
  "minOrderTotal" DECIMAL(65,30),
  "maxDiscountAmount" DECIMAL(65,30),
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "usageLimit" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "perCustomerLimit" INTEGER,
  "segmentKey" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CouponRedemption" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "orderId" TEXT,
  "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "pointsSpent" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyLedger_organizationId_orderId_type_key"
  ON "LoyaltyLedger"("organizationId", "orderId", "type");

CREATE INDEX IF NOT EXISTS "LoyaltyLedger_organizationId_customerId_createdAt_idx"
  ON "LoyaltyLedger"("organizationId", "customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "LoyaltyLedger_customerId_createdAt_idx"
  ON "LoyaltyLedger"("customerId", "createdAt");

CREATE INDEX IF NOT EXISTS "LoyaltyLedger_orderId_idx"
  ON "LoyaltyLedger"("orderId");

CREATE INDEX IF NOT EXISTS "LoyaltyLedger_createdByUserId_idx"
  ON "LoyaltyLedger"("createdByUserId");

CREATE INDEX IF NOT EXISTS "LoyaltyRule_organizationId_isActive_idx"
  ON "LoyaltyRule"("organizationId", "isActive");

CREATE INDEX IF NOT EXISTS "LoyaltyRule_organizationId_createdAt_idx"
  ON "LoyaltyRule"("organizationId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_organizationId_code_key"
  ON "Coupon"("organizationId", "code");

CREATE INDEX IF NOT EXISTS "Coupon_organizationId_isActive_idx"
  ON "Coupon"("organizationId", "isActive");

CREATE INDEX IF NOT EXISTS "Coupon_organizationId_segmentKey_idx"
  ON "Coupon"("organizationId", "segmentKey");

CREATE UNIQUE INDEX IF NOT EXISTS "CouponRedemption_couponId_orderId_key"
  ON "CouponRedemption"("couponId", "orderId");

CREATE INDEX IF NOT EXISTS "CouponRedemption_organizationId_customerId_redeemedAt_idx"
  ON "CouponRedemption"("organizationId", "customerId", "redeemedAt");

CREATE INDEX IF NOT EXISTS "CouponRedemption_couponId_redeemedAt_idx"
  ON "CouponRedemption"("couponId", "redeemedAt");

CREATE INDEX IF NOT EXISTS "CouponRedemption_orderId_idx"
  ON "CouponRedemption"("orderId");

DO $$ BEGIN
  ALTER TABLE "LoyaltyLedger"
    ADD CONSTRAINT "LoyaltyLedger_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoyaltyLedger"
    ADD CONSTRAINT "LoyaltyLedger_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoyaltyLedger"
    ADD CONSTRAINT "LoyaltyLedger_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoyaltyLedger"
    ADD CONSTRAINT "LoyaltyLedger_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LoyaltyRule"
    ADD CONSTRAINT "LoyaltyRule_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Coupon"
    ADD CONSTRAINT "Coupon_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_couponId_fkey"
    FOREIGN KEY ("couponId") REFERENCES "Coupon"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CouponRedemption"
    ADD CONSTRAINT "CouponRedemption_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
