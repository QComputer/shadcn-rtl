/*
  Warnings:

  - You are about to drop the column `guestCustomerId` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `guestCustomerId` on the `ShopCart` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "GuestCart_sessionId_key";

-- CreateTable
CREATE TABLE "TimeInterval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "start" DATETIME,
    "end" DATETIME,
    "note" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "timeIntervalid" TEXT,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "cancelledBy" TEXT,
    "confirmedAt" DATETIME,
    "confirmedBy" TEXT,
    "reminderSentAt" DATETIME,
    "reminderSentBy" TEXT,
    "followUpSentAt" DATETIME,
    "followUpSentBy" TEXT,
    "customerNameAtBooking" TEXT,
    "customerPhoneAtBooking" TEXT,
    "customerEmailAtBooking" TEXT,
    "bookingReference" TEXT,
    "customerId" TEXT,
    "guestCustomerId" TEXT,
    "serviceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "Appointment_timeIntervalid_fkey" FOREIGN KEY ("timeIntervalid") REFERENCES "TimeInterval" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_guestCustomerId_fkey" FOREIGN KEY ("guestCustomerId") REFERENCES "GuestCustomer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("bookingReference", "cancellationReason", "cancelledAt", "cancelledBy", "confirmedAt", "confirmedBy", "createdAt", "customerEmailAtBooking", "customerId", "customerNameAtBooking", "customerPhoneAtBooking", "date", "deletedAt", "endTime", "followUpSentAt", "followUpSentBy", "guestCustomerId", "id", "notes", "reminderSentAt", "reminderSentBy", "serviceId", "startTime", "status", "updatedAt") SELECT "bookingReference", "cancellationReason", "cancelledAt", "cancelledBy", "confirmedAt", "confirmedBy", "createdAt", "customerEmailAtBooking", "customerId", "customerNameAtBooking", "customerPhoneAtBooking", "date", "deletedAt", "endTime", "followUpSentAt", "followUpSentBy", "guestCustomerId", "id", "notes", "reminderSentAt", "reminderSentBy", "serviceId", "startTime", "status", "updatedAt" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE UNIQUE INDEX "Appointment_bookingReference_key" ON "Appointment"("bookingReference");
CREATE INDEX "Appointment_customerId_idx" ON "Appointment"("customerId");
CREATE INDEX "Appointment_guestCustomerId_idx" ON "Appointment"("guestCustomerId");
CREATE INDEX "Appointment_serviceId_idx" ON "Appointment"("serviceId");
CREATE INDEX "Appointment_date_idx" ON "Appointment"("date");
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");
CREATE INDEX "Appointment_deletedAt_idx" ON "Appointment"("deletedAt");
CREATE INDEX "Appointment_bookingReference_idx" ON "Appointment"("bookingReference");
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL NOT NULL,
    "deliveryFee" DECIMAL NOT NULL DEFAULT 0,
    "tax" DECIMAL NOT NULL DEFAULT 0,
    "discount" DECIMAL NOT NULL DEFAULT 0,
    "total" DECIMAL NOT NULL,
    "deliveryAddress" TEXT,
    "estimatedDeliveryTime" DATETIME,
    "deliveredAt" DATETIME,
    "notes" TEXT,
    "paidAt" DATETIME,
    "paymentMethod" TEXT,
    "paymentId" TEXT,
    "promotionId" TEXT,
    "promotionCode" TEXT,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "driverId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    "preparationProgressId" TEXT,
    "pickupProgressId" TEXT,
    "deliveryProgressId" TEXT,
    CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_preparationProgressId_fkey" FOREIGN KEY ("preparationProgressId") REFERENCES "Progress" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_pickupProgressId_fkey" FOREIGN KEY ("pickupProgressId") REFERENCES "Progress" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_deliveryProgressId_fkey" FOREIGN KEY ("deliveryProgressId") REFERENCES "Progress" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("createdAt", "customerId", "deletedAt", "deliveredAt", "deliveryAddress", "deliveryFee", "deliveryProgressId", "discount", "driverId", "estimatedDeliveryTime", "id", "notes", "orderNumber", "organizationId", "paidAt", "paymentId", "paymentMethod", "pickupProgressId", "preparationProgressId", "promotionCode", "promotionId", "status", "subtotal", "tax", "total", "type", "updatedAt") SELECT "createdAt", "customerId", "deletedAt", "deliveredAt", "deliveryAddress", "deliveryFee", "deliveryProgressId", "discount", "driverId", "estimatedDeliveryTime", "id", "notes", "orderNumber", "organizationId", "paidAt", "paymentId", "paymentMethod", "pickupProgressId", "preparationProgressId", "promotionCode", "promotionId", "status", "subtotal", "tax", "total", "type", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_preparationProgressId_key" ON "Order"("preparationProgressId");
CREATE UNIQUE INDEX "Order_pickupProgressId_key" ON "Order"("pickupProgressId");
CREATE UNIQUE INDEX "Order_deliveryProgressId_key" ON "Order"("deliveryProgressId");
CREATE INDEX "Order_organizationId_idx" ON "Order"("organizationId");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX "Order_sessionId_idx" ON "Order"("sessionId");
CREATE INDEX "Order_driverId_idx" ON "Order"("driverId");
CREATE INDEX "Order_preparationProgressId_idx" ON "Order"("preparationProgressId");
CREATE INDEX "Order_pickupProgressId_idx" ON "Order"("pickupProgressId");
CREATE INDEX "Order_deliveryProgressId_idx" ON "Order"("deliveryProgressId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "Order_deletedAt_idx" ON "Order"("deletedAt");
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");
CREATE INDEX "Order_promotionId_idx" ON "Order"("promotionId");
CREATE TABLE "new_ShopCart" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,
    "sessionId" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopCart_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShopCart_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShopCart" ("createdAt", "customerId", "expiresAt", "id", "organizationId", "sessionId", "status", "updatedAt") SELECT "createdAt", "customerId", "expiresAt", "id", "organizationId", "sessionId", "status", "updatedAt" FROM "ShopCart";
DROP TABLE "ShopCart";
ALTER TABLE "new_ShopCart" RENAME TO "ShopCart";
CREATE INDEX "ShopCart_status_idx" ON "ShopCart"("status");
CREATE INDEX "ShopCart_customerId_idx" ON "ShopCart"("customerId");
CREATE INDEX "ShopCart_organizationId_customerId_idx" ON "ShopCart"("organizationId", "customerId");
CREATE INDEX "ShopCart_sessionId_idx" ON "ShopCart"("sessionId");
CREATE INDEX "ShopCart_organizationId_sessionId_idx" ON "ShopCart"("organizationId", "sessionId");
CREATE UNIQUE INDEX "ShopCart_organizationId_customerId_key" ON "ShopCart"("organizationId", "customerId");
CREATE UNIQUE INDEX "ShopCart_organizationId_sessionId_key" ON "ShopCart"("organizationId", "sessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
