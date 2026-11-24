import assert from "node:assert/strict";
import test from "node:test";
import { getReservationCenterReadinessIssues } from "@/lib/hotel/management/reservation-center-readiness";

test("reservation center explains missing operational setup and disabled manual intake", () => {
  assert.deepEqual(getReservationCenterReadinessIssues({
    roomTypeCount: 0,
    ratePlanCount: 0,
    selectedRoomHasPhysicalRooms: false,
    manualRoomManagementEnabled: false,
  }), ["NO_ROOM_TYPES", "MANUAL_RESERVATIONS_DISABLED"]);
});

test("reservation center identifies missing rate plans and physical rooms", () => {
  assert.deepEqual(getReservationCenterReadinessIssues({
    roomTypeCount: 2,
    ratePlanCount: 0,
    selectedRoomHasPhysicalRooms: false,
    manualRoomManagementEnabled: true,
  }), ["NO_RATE_PLANS", "NO_PHYSICAL_ROOMS"]);
});

test("reservation center reports no setup issue when manual intake is ready", () => {
  assert.deepEqual(getReservationCenterReadinessIssues({
    roomTypeCount: 2,
    ratePlanCount: 1,
    selectedRoomHasPhysicalRooms: true,
    manualRoomManagementEnabled: true,
  }), []);
});

test("reservation center does not infer manual intake is disabled if the field is absent", () => {
  assert.deepEqual(getReservationCenterReadinessIssues({
    roomTypeCount: 0,
    ratePlanCount: 0,
    selectedRoomHasPhysicalRooms: false,
  }), ["NO_ROOM_TYPES"]);
});
