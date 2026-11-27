import { normalizeDigits } from "../integrations/inoti-ussd/parser";
import { isProgressiveChallengeId } from "./progressive-contract";
import type { GuestClaimKind } from "./guest-claim.contract";
export type GuestClaimInput = { action: "LIST"; kind: GuestClaimKind } | { action: "REQUEST"; kind: GuestClaimKind; recordId: string; claimConfirmed: true } | { action: "CLAIM"; kind: GuestClaimKind; recordId: string; claimConfirmed: true; challengeId: string; otp: string };
export function guestClaimHttpEnabled(env: Record<string, string | undefined> = process.env) {
  return env.CUSTOMER_GUEST_CLAIM_ENABLED === "1" && env.CUSTOMER_PROGRESSIVE_ENROLLMENT_ENABLED === "1" && env.CUSTOMER_PHONE_AUTH_ENABLED === "1";
}
export function parseGuestClaimInput(value: unknown): GuestClaimInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (v.kind !== "ORDER" && v.kind !== "APPOINTMENT") return null;
  const keys = Object.keys(v);
  if (v.action === "LIST") return keys.every(k => ["action", "kind"].includes(k)) ? { action: v.action, kind: v.kind } : null;
  if (v.action !== "REQUEST" && v.action !== "CLAIM") return null;
  if (typeof v.recordId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(v.recordId) || v.claimConfirmed !== true) return null;
  const base: { kind: GuestClaimKind; recordId: string; claimConfirmed: true } = { kind: v.kind, recordId: v.recordId, claimConfirmed: true as const };
  const allowed = ["action", "kind", "recordId", "claimConfirmed"];
  if (v.action === "REQUEST") return keys.every(k => allowed.includes(k)) ? { action: v.action, ...base } : null;
  if (!keys.every(k => [...allowed, "challengeId", "otp"].includes(k)) || !isProgressiveChallengeId(v.challengeId) || typeof v.otp !== "string" || v.otp.length > 16) return null;
  const otp = normalizeDigits(v.otp).trim();
  return /^\d{4}$/.test(otp) ? { action: v.action, ...base, challengeId: v.challengeId, otp } : null;
}
