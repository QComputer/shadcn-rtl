export type ReservationCenterReadinessIssue =
  | "NO_ROOM_TYPES"
  | "NO_RATE_PLANS"
  | "NO_PHYSICAL_ROOMS"
  | "MANUAL_RESERVATIONS_DISABLED";

export function getReservationCenterReadinessIssues(input: {
  roomTypeCount: number;
  ratePlanCount: number;
  selectedRoomHasPhysicalRooms: boolean;
  manualRoomManagementEnabled?: boolean;
}): ReservationCenterReadinessIssue[] {
  const issues: ReservationCenterReadinessIssue[] = [];
  if (input.roomTypeCount === 0) issues.push("NO_ROOM_TYPES");
  else if (input.ratePlanCount === 0) issues.push("NO_RATE_PLANS");
  if (input.roomTypeCount > 0 && !input.selectedRoomHasPhysicalRooms) {
    issues.push("NO_PHYSICAL_ROOMS");
  }
  if (input.manualRoomManagementEnabled === false) {
    issues.push("MANUAL_RESERVATIONS_DISABLED");
  }
  return issues;
}
