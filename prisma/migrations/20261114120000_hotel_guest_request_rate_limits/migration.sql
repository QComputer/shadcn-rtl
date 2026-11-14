CREATE TABLE "HotelGuestRequestRateLimit" (
  "organizationId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelGuestRequestRateLimit_pkey" PRIMARY KEY ("organizationId", "endpoint"),
  CONSTRAINT "HotelGuestRequestRateLimit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
