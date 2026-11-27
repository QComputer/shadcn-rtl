import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeIranianMobile } from "../../integrations/inoti-ussd/parser";

export const HOTEL_GUEST_PROOF_TTL_SECONDS = 180 * 24 * 60 * 60;
const id = (v: string) => /^[A-Za-z0-9_-]{1,128}$/.test(v);
const digest = (v: string) => /^[0-9a-f]{64}$/.test(v);
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
export type HotelGuestProofScope = { reservationId: string; organizationId: string; propertyId: string; origin: string };
export type HotelGuestReservationProof = HotelGuestProofScope & { browserDigest: string; contactDigest: string; createdAt: Date; expiresAt: Date };
export function hotelGuestProofEnabled(env: Record<string, string | undefined> = process.env) {
  return env.HOTEL_GUEST_CLAIM_PROOF_ENABLED === "1";
}
function validOrigin(origin: string) {
  if (origin.length > 256) return false;
  try {
    const url = new URL(origin);
    return url.origin === origin && (url.protocol === "https:" || (url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".localhost"))));
  } catch { return false; }
}
export function validHotelGuestBrowserToken(value: string) {
  return tokenPattern.test(value) && Buffer.from(value, "base64url").length === 32 && Buffer.from(value, "base64url").toString("base64url") === value;
}
function validScope(scope: HotelGuestProofScope) {
  return [scope.reservationId, scope.organizationId, scope.propertyId].every(id) && validOrigin(scope.origin);
}
function hash(kind: "browser" | "contact", scope: HotelGuestProofScope, value: string, secret: string) {
  return createHmac("sha256", secret).update(JSON.stringify(["hotel-reservation-proof:v1", kind, scope.organizationId, scope.propertyId, scope.reservationId, scope.origin, value])).digest("hex");
}
export function buildHotelGuestReservationProof(scope: HotelGuestProofScope, browserToken: string, phone: string, secret: string, now: Date): HotelGuestReservationProof | null {
  const normalized = normalizeIranianMobile(phone);
  if (!validScope(scope) || Buffer.byteLength(secret, "utf8") < 32 || !normalized || !validHotelGuestBrowserToken(browserToken) || !Number.isFinite(now.getTime())) return null;
  return { ...scope, browserDigest: hash("browser", scope, browserToken, secret), contactDigest: hash("contact", scope, normalized, secret), createdAt: now, expiresAt: new Date(now.getTime() + HOTEL_GUEST_PROOF_TTL_SECONDS * 1000) };
}
/** Internal proof shape check, not an authorization check. */
export function validHotelGuestReservationProof(proof: HotelGuestReservationProof, reservation: { id: string; organizationId: string; propertyId: string; createdAt: Date; holdId?: string; status: string }) {
  return validScope(proof) && proof.reservationId === reservation.id && proof.organizationId === reservation.organizationId && proof.propertyId === reservation.propertyId && Boolean(reservation.holdId) && reservation.status === "PENDING_PAYMENT" && digest(proof.browserDigest) && digest(proof.contactDigest) && Number.isFinite(proof.createdAt.getTime()) && proof.createdAt <= reservation.createdAt && reservation.createdAt.getTime() - proof.createdAt.getTime() <= 60_000 && proof.expiresAt.getTime() - proof.createdAt.getTime() === HOTEL_GUEST_PROOF_TTL_SECONDS * 1000;
}
/** Proof matching alone NEVER grants ownership; later claim must also validate authenticated session, completed stay and OTP atomically. */
export function matchesHotelGuestReservationProof(proof: HotelGuestReservationProof, scope: HotelGuestProofScope, browserToken: string, phone: string, secret: string, now: Date) {
  if (proof.reservationId !== scope.reservationId || proof.organizationId !== scope.organizationId || proof.propertyId !== scope.propertyId || proof.origin !== scope.origin || !(proof.createdAt <= now && now < proof.expiresAt) || !digest(proof.browserDigest) || !digest(proof.contactDigest)) return false;
  const candidate = buildHotelGuestReservationProof(scope, browserToken, phone, secret, now);
  return !!candidate && timingSafeEqual(Buffer.from(proof.browserDigest, "hex"), Buffer.from(candidate.browserDigest, "hex")) && timingSafeEqual(Buffer.from(proof.contactDigest, "hex"), Buffer.from(candidate.contactDigest, "hex"));
}
export function hotelGuestProofCookieName(origin: string, production: boolean) {
  if (!validOrigin(origin) || (production && !origin.startsWith("https://"))) return null;
  return origin.startsWith("https://") ? "__Host-bazarbaaz_hotel_claim" : "bazarbaaz_hotel_claim_dev";
}
/** Do not accept duplicates, malformed or externally supplied noncanonical cookies.
 * Only an absent cookie receives a new 256-bit credential. */
export function hotelGuestBrowserCredential(rawCookie: string | null, name: string) {
  const values = (rawCookie ?? "").split(";").map(part => part.trim()).filter(part => part.split("=", 1)[0].trim() === name);
  if (values.length === 0) return { token: randomBytes(32).toString("base64url"), minted: true };
  if (values.length !== 1 || !values[0].startsWith(`${name}=`)) return null;
  const token = values[0].slice(name.length + 1);
  return validHotelGuestBrowserToken(token) ? { token, minted: false } : null;
}
export function hotelGuestProofSetCookie(name: string, token: string) {
  if (!["__Host-bazarbaaz_hotel_claim", "bazarbaaz_hotel_claim_dev"].includes(name) || !validHotelGuestBrowserToken(token)) throw new Error("INVALID_HOTEL_GUEST_PROOF_COOKIE");
  return `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${HOTEL_GUEST_PROOF_TTL_SECONDS}${name.startsWith("__Host-") ? "; Secure" : ""}`;
}
