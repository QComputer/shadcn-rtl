import { receptionDateIssue } from "./property-calendar";
export const WAITLIST_PAGE_SIZE = 25;
export const WAITLIST_STATUSES = ["WAITING", "CONTACTED", "BOOKED", "CANCELLED", "EXPIRED"] as const;
export type WaitlistStatus = typeof WAITLIST_STATUSES[number];
export type WaitlistEntry = { id: string; guestName: string; phone: string; roomTypeId: string; roomTypeName: string; checkIn: string; checkOut: string; adults: number; childAges: number[]; status: WaitlistStatus; version: number; reservationReference: string | null; createdAt: string };
export type WaitlistResponse = { items: WaitlistEntry[]; page: number; hasMore: boolean };
export function waitlistTransitionAllowed(status: string, next: string, checkIn: string, today: string): boolean {
  if (status !== "WAITING" && status !== "CONTACTED") return false;
  if (next === "CANCELLED") return true;
  if (next === "EXPIRED") return checkIn < today;
  if (checkIn < today) return false;
  return next === "BOOKED" || (status === "WAITING" && next === "CONTACTED") || (status === "CONTACTED" && next === "WAITING");
}
export function waitlistStayAllowed(checkIn: string, checkOut: string, today: string, min: number, max: number) {
  if (receptionDateIssue(checkIn, checkOut, today)) return false;
  const nights = (Date.parse(checkOut + "T00:00:00Z") - Date.parse(checkIn + "T00:00:00Z")) / 86400000;
  return nights >= min && nights <= Math.min(max, 31);
}
