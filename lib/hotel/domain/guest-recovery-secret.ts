import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeIranianMobile } from "../../integrations/inoti-ussd/parser";
import { validHotelGuestBrowserToken, type HotelGuestProofScope } from "./guest-reservation-proof";

/** Recovery closes 180 days after the booked checkout date. */
export const HOTEL_RECOVERY_TTL_MS = 180 * 24 * 60 * 60 * 1000;
export type HotelRecoveryEvidence = HotelGuestProofScope & {
  secretDigest: string; contactDigest: string; createdAt: Date; expiresAt: Date; redeemedAt: Date | null;
};

function validScope(scope: HotelGuestProofScope) {
  if (![scope.reservationId, scope.organizationId, scope.propertyId].every(v => /^[A-Za-z0-9_-]{1,128}$/.test(v))) return false;
  try {
    const url = new URL(scope.origin);
    return scope.origin.length <= 256 && url.origin === scope.origin && (url.protocol === "https:" || (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".localhost"))));
  } catch { return false; }
}
function digest(kind: "credential" | "contact", scope: HotelGuestProofScope, value: string, key: string) {
  return createHmac("sha256", key).update(JSON.stringify(["hotel-reservation-recovery:v1", kind, scope.organizationId, scope.propertyId, scope.reservationId, scope.origin, value])).digest("hex");
}
export function createHotelRecoverySecret() { return randomBytes(32).toString("base64url"); }
export function buildHotelRecoveryEvidence(scope: HotelGuestProofScope, credential: string, phone: string, key: string, now: Date, checkOut: Date): HotelRecoveryEvidence | null {
  const normalized = normalizeIranianMobile(phone);
  if (!validScope(scope) || !validHotelGuestBrowserToken(credential) || !normalized || Buffer.byteLength(key, "utf8") < 32 || !Number.isFinite(now.getTime()) || !Number.isFinite(checkOut.getTime()) || checkOut.getTime() + HOTEL_RECOVERY_TTL_MS <= now.getTime()) return null;
  return { ...scope, secretDigest: digest("credential", scope, credential, key), contactDigest: digest("contact", scope, normalized, key), createdAt: now, expiresAt: new Date(checkOut.getTime() + HOTEL_RECOVERY_TTL_MS), redeemedAt: null };
}
/** Evidence verification is necessary but never sufficient to grant ownership. */
export function matchesHotelRecoveryEvidence(evidence: HotelRecoveryEvidence, scope: HotelGuestProofScope, credential: string, phone: string, key: string, now: Date) {
  if (evidence.redeemedAt || evidence.reservationId !== scope.reservationId || evidence.organizationId !== scope.organizationId || evidence.propertyId !== scope.propertyId || evidence.origin !== scope.origin || !(evidence.createdAt <= now && now < evidence.expiresAt)) return false;
  if (!/^[a-f0-9]{64}$/.test(evidence.secretDigest) || !/^[a-f0-9]{64}$/.test(evidence.contactDigest)) return false;
  const candidate = buildHotelRecoveryEvidence(scope, credential, phone, key, now, new Date(evidence.expiresAt.getTime() - HOTEL_RECOVERY_TTL_MS));
  return !!candidate && timingSafeEqual(Buffer.from(evidence.secretDigest, "hex"), Buffer.from(candidate.secretDigest, "hex")) && timingSafeEqual(Buffer.from(evidence.contactDigest, "hex"), Buffer.from(candidate.contactDigest, "hex"));
}

/** Validate persistence input against the actual newly created reservation. */
export function validHotelRecoveryEvidence(evidence: HotelRecoveryEvidence, reservation: { id: string; organizationId: string; propertyId: string; createdAt: Date; checkOut: string; holdId?: string; status: string }) {
  const checkout = new Date(`${reservation.checkOut}T00:00:00.000Z`);
  return validScope(evidence) && evidence.reservationId === reservation.id && evidence.organizationId === reservation.organizationId &&
    evidence.propertyId === reservation.propertyId && Boolean(reservation.holdId) && reservation.status === "PENDING_PAYMENT" &&
    /^[a-f0-9]{64}$/.test(evidence.secretDigest) && /^[a-f0-9]{64}$/.test(evidence.contactDigest) &&
    evidence.redeemedAt === null && Number.isFinite(evidence.createdAt.getTime()) && evidence.createdAt <= reservation.createdAt &&
    reservation.createdAt.getTime() - evidence.createdAt.getTime() <= 60_000 &&
    Number.isFinite(checkout.getTime()) && evidence.expiresAt.getTime() === checkout.getTime() + HOTEL_RECOVERY_TTL_MS &&
    evidence.expiresAt > evidence.createdAt;
}
