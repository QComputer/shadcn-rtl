import { customerAuthDigest } from "./crypto";
import { normalizeIranianMobile } from "../integrations/inoti-ussd/parser";
import { appointmentGuestSessionPattern } from "../appointments/guest-scope";

export type GuestClaimKind = "ORDER" | "APPOINTMENT";
/** Server-only caller contract: user, session, organization, origin and browser
 * cookie must come from trusted, authenticated request context, never the body.
 * No HTTP entry point exists in G3-B1. */
export type GuestClaimScope = {
  kind: GuestClaimKind;
  recordId: string;
  userId: string;
  sessionId: string;
  organizationId: string;
  origin: string;
  guestSessionId: string;
  phone: string;
  claimConfirmed: true;
};
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export function guestClaimBinding(scope: GuestClaimScope, secret: string): string | null {
  if (secret.length < 32 || !scope || !["ORDER", "APPOINTMENT"].includes(scope.kind) || scope.claimConfirmed !== true ||
    ![scope.recordId, scope.userId, scope.sessionId, scope.organizationId].every(id) ||
    typeof scope.guestSessionId !== "string" || !appointmentGuestSessionPattern.test(scope.guestSessionId) ||
    typeof scope.phone !== "string" || scope.phone.length > 64 || !normalizeIranianMobile(scope.phone) ||
    typeof scope.origin !== "string" || scope.origin.length > 256) return null;
  try { if (new URL(scope.origin).origin !== scope.origin) return null; } catch { return null; }
  return customerAuthDigest(JSON.stringify(["guest-record-claim:v1", scope.kind, scope.recordId, scope.userId, scope.sessionId,
    scope.organizationId, scope.origin, scope.guestSessionId, normalizeIranianMobile(scope.phone)]), secret);
}
