export const GUEST_PROFILE_PAGE_SIZE = 25;
export const GUEST_PROFILE_MAX_PAGE = 400;
export function cleanGuestProfileName(value: string): string | null {
  const name = value.trim().normalize("NFC");
  return name.length >= 1 && name.length <= 160 && !/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(name) ? name : null;
}
export type GuestProfile = { id: string; displayName: string; version: number };
export type GuestProfileStay = { guestId: string; fullName: string; reference: string; status: string; checkIn: string; checkOut: string };
export type GuestProfileResponse =
  | { kind: "list"; canManage: boolean; items: GuestProfile[]; page: number; hasMore: boolean }
  | { kind: "detail"; canManage: boolean; profile: GuestProfile; stays: GuestProfileStay[]; page: number; hasMore: boolean }
  | { kind: "guest"; canManage: boolean; guestId: string; fullName: string; profile: GuestProfile | null }
  | { kind: "saved"; profile: GuestProfile | null };
