export const HOTEL_GUEST_REQUEST_STATUSES = [
  "RECEIVED",
  "IN_REVIEW",
  "OPTION_OFFERED",
  "UNAVAILABLE",
  "DECLINED",
  "CLOSED",
] as const;

export type HotelGuestBookingRequestStatus = (typeof HOTEL_GUEST_REQUEST_STATUSES)[number];

const transitions: Record<HotelGuestBookingRequestStatus, readonly HotelGuestBookingRequestStatus[]> = {
  RECEIVED: ["IN_REVIEW", "OPTION_OFFERED", "UNAVAILABLE", "DECLINED", "CLOSED"],
  IN_REVIEW: ["OPTION_OFFERED", "UNAVAILABLE", "DECLINED", "CLOSED"],
  OPTION_OFFERED: ["IN_REVIEW", "CLOSED"],
  UNAVAILABLE: ["IN_REVIEW", "CLOSED"],
  DECLINED: ["CLOSED"],
  CLOSED: [],
};

/** Request states intentionally contain no CONFIRMED/BOOKED state. */
export function canTransitionHotelGuestBookingRequest(
  from: HotelGuestBookingRequestStatus,
  to: HotelGuestBookingRequestStatus,
) {
  return transitions[from].includes(to);
}
