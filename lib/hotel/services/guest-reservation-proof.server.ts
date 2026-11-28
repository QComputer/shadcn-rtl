import "server-only";
import { resolveCustomerAuthContext } from "@/lib/customer-auth/context.server";
import { buildHotelGuestReservationProof, hotelGuestBrowserCredential, hotelGuestProofCookieName, hotelGuestProofEnabled, hotelGuestProofSetCookie } from "@/lib/hotel/domain/guest-reservation-proof";

/** Capture only before a genuinely new non-demo anonymous booking. The caller
 * must persist the returned proof inside the reservation creation transaction,
 * and must not issue the cookie for an existing reservation or a concurrent replay. */
export async function prepareHotelGuestReservationProof(request: Request, scope: { reservationId: string; organizationId: string; propertyId: string }, phone: string, now: Date) {
  if (!hotelGuestProofEnabled()) return null;
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) return null;
  const context = await resolveCustomerAuthContext(request);
  if (!context || context.organizationId !== scope.organizationId || request.headers.get("origin") !== context.origin) return null;
  const name = hotelGuestProofCookieName(context.origin, process.env.NODE_ENV === "production");
  if (!name) return null;
  const credential = hotelGuestBrowserCredential(request.headers.get("cookie"), name);
  if (!credential) return null;
  const proof = buildHotelGuestReservationProof({ ...scope, origin: context.origin }, credential.token, phone, secret, now);
  return proof ? { proof, setCookie: hotelGuestProofSetCookie(name, credential.token) } : null;
}
