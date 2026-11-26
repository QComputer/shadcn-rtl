import { createHash } from "node:crypto";
import { normalizeIranianMobile, normalizeDigits } from "@/lib/integrations/inoti-ussd/parser";

export const appointmentGuestCookieName = () => process.env.SESSION_COOKIE_NAME || "guest_session_id_local";
export const appointmentGuestSessionPattern = /^(?:appointment-)?[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function appointmentGuestScope(organizationId: string, sessionId: string) {
  return `appointment:v1:${createHash("sha256").update(JSON.stringify([organizationId, sessionId])).digest("hex")}:`;
}
// Retain ownership of historical records; new records never persist the bearer cookie.
export function appointmentGuestFilter(organizationId: string, sessionId: string) {
  return { OR: [{ sessionId }, { sessionId: { startsWith: appointmentGuestScope(organizationId, sessionId) } }] };
}
// Contact is only a coordination hint and abuse-budget input, never owner proof.
export function appointmentContactPhone(value: string): string | null {
  const compact = normalizeDigits(value).trim().replace(/[\s-]/g, "");
  return normalizeIranianMobile(compact) ?? (/^\+?\d{10,15}$/.test(compact) ? compact.replace(/^\+/, "") : null);
}
