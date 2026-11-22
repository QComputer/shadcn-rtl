CREATE UNIQUE INDEX "HotelRoom_id_organizationId_propertyId_key"
  ON "HotelRoom"("id", "organizationId", "propertyId");

CREATE TABLE "HotelRoomMaintenanceBlock" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "from" DATE NOT NULL,
  "to" DATE NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestFingerprint" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedBy" TEXT,
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "HotelRoomMaintenanceBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HotelRoomMaintenanceBlock_valid_range" CHECK ("from" < "to"),
  CONSTRAINT "HotelRoomMaintenanceBlock_propertyId_organizationId_fkey"
    FOREIGN KEY ("propertyId", "organizationId") REFERENCES "HotelProperty"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "HotelRoomMaintenanceBlock_roomId_organizationId_propertyId_fkey"
    FOREIGN KEY ("roomId", "organizationId", "propertyId") REFERENCES "HotelRoom"("id", "organizationId", "propertyId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "HotelRoomMaintenanceBlock_id_organizationId_key"
  ON "HotelRoomMaintenanceBlock"("id", "organizationId");
CREATE UNIQUE INDEX "HotelRoomMaintenanceBlock_organizationId_idempotencyKey_key"
  ON "HotelRoomMaintenanceBlock"("organizationId", "idempotencyKey");
CREATE INDEX "HotelRoomMaintenanceBlock_organizationId_propertyId_from_to_idx"
  ON "HotelRoomMaintenanceBlock"("organizationId", "propertyId", "from", "to");
CREATE INDEX "HotelRoomMaintenanceBlock_organizationId_roomId_from_to_rel_idx"
  ON "HotelRoomMaintenanceBlock"("organizationId", "roomId", "from", "to", "releasedAt");

CREATE OR REPLACE FUNCTION hotel_reject_room_assignment_during_maintenance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."roomId" IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM "HotelRoom"
   WHERE "id" = NEW."roomId" AND "organizationId" = NEW."organizationId"
   FOR UPDATE;

  IF EXISTS (
    SELECT 1
      FROM "HotelRoomMaintenanceBlock" b
     WHERE b."organizationId" = NEW."organizationId"
       AND b."roomId" = NEW."roomId"
       AND b."releasedAt" IS NULL
       AND NEW."date" >= b."from" AND NEW."date" < b."to"
  ) THEN
    RAISE EXCEPTION 'ROOM_MAINTENANCE_CONFLICT' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HotelReservationRoom_maintenance_guard"
BEFORE INSERT OR UPDATE OF "roomId", "date" ON "HotelReservationRoom"
FOR EACH ROW EXECUTE FUNCTION hotel_reject_room_assignment_during_maintenance();

CREATE OR REPLACE FUNCTION hotel_reject_maintenance_over_reservation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."releasedAt" IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM 1 FROM "HotelRoom"
   WHERE "id" = NEW."roomId" AND "organizationId" = NEW."organizationId"
   FOR UPDATE;

  IF EXISTS (
    SELECT 1
      FROM "HotelReservationRoom" n
      JOIN "HotelReservation" r
        ON r."id" = n."reservationId" AND r."organizationId" = n."organizationId"
     WHERE n."organizationId" = NEW."organizationId"
       AND n."roomId" = NEW."roomId"
       AND n."date" >= NEW."from" AND n."date" < NEW."to"
       AND r."status" IN ('HELD', 'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN')
  ) THEN
    RAISE EXCEPTION 'ROOM_MAINTENANCE_CONFLICT' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "HotelRoomMaintenanceBlock_reservation_guard"
BEFORE INSERT OR UPDATE OF "roomId", "from", "to", "releasedAt" ON "HotelRoomMaintenanceBlock"
FOR EACH ROW EXECUTE FUNCTION hotel_reject_maintenance_over_reservation();
