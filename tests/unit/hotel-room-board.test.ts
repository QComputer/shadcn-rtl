import assert from "node:assert/strict";
import { test } from "node:test";
import { buildHotelRoomBoard } from "../../lib/hotel/management/room-board";

test("hotel room board uses half-open dates, assigned nights, and stable room ordering", () => {
  const board = buildHotelRoomBoard({
    from: "2027-08-01",
    to: "2027-08-03",
    rooms: [
      { id: "room-2", code: "12", roomTypeId: "type-a", isOutOfService: false },
      { id: "room-1", code: "2", roomTypeId: "type-a", isOutOfService: false },
    ],
    reservations: [
      { reference: "R-1", status: "CONFIRMED", nights: [{ date: "2027-08-01", roomId: "room-1" }, { date: "2027-08-03", roomId: "room-1" }, { date: "2027-08-02", roomId: null }] },
      { reference: "R-2", status: "CHECKED_IN", nights: [{ date: "2027-08-02", roomId: "room-2" }] },
    ],
  });

  assert.deepEqual(board.dates, ["2027-08-01", "2027-08-02"]);
  assert.deepEqual(board.rooms.map((room) => room.id), ["room-1", "room-2"]);
  assert.deepEqual(board.rooms[0].nights.map((night) => night.status), ["RESERVED", "VACANT"]);
  assert.deepEqual(board.rooms[1].nights.map((night) => night.status), ["VACANT", "OCCUPIED"]);
  assert.equal(board.rooms[0].nights[0].reference, "R-1");
  assert.equal(board.rooms[1].nights[1].reference, "R-2");
  assert.equal(board.unassignedReservationNights, 1);
});

test("hotel room board surfaces an allocation conflict on an out-of-service room", () => {
  const board = buildHotelRoomBoard({
    from: "2027-08-01",
    to: "2027-08-02",
    rooms: [{ id: "room-1", code: "201", roomTypeId: "type-a", isOutOfService: true }],
    reservations: [{ reference: "R-1", status: "CHECKED_IN", nights: [{ date: "2027-08-01", roomId: "room-1" }] }],
  });

  assert.deepEqual(board.rooms[0].nights, [{ date: "2027-08-01", status: "OUT_OF_SERVICE_CONFLICT", reference: "R-1" }]);
});

test("hotel room board marks dated maintenance and an allocated maintenance conflict", () => {
  const board = buildHotelRoomBoard({
    from: "2027-08-01",
    to: "2027-08-04",
    rooms: [{ id: "room-1", code: "201", roomTypeId: "type-a", isOutOfService: false }],
    reservations: [{ reference: "R-1", status: "CONFIRMED", nights: [{ date: "2027-08-02", roomId: "room-1" }] }],
    maintenanceBlocks: [{ roomId: "room-1", from: "2027-08-02", to: "2027-08-04" }],
  });

  assert.deepEqual(board.rooms[0].nights.map(({ status }) => status), ["VACANT", "MAINTENANCE_CONFLICT", "MAINTENANCE"]);
});
