import { normalizeDigits, normalizeIranianMobile } from "../integrations/inoti-ussd/parser";

// This runtime gate is server-owned, deliberately off unless explicitly enabled.
export function progressiveCustomerEnrollmentEnabled(value = process.env.CUSTOMER_PROGRESSIVE_ENROLLMENT_ENABLED): boolean {
  return value === "1";
}

export type AccountVerificationPurpose = "ACCOUNT_SIGN_IN" | "ACCOUNT_ENROLL";
export type ProgressiveRequest = {
  phone: string;
  organization: string;
} & ({ purpose: "ACCOUNT_SIGN_IN" } | { purpose: "ACCOUNT_ENROLL"; enrollmentConfirmed: true });
export type ProgressiveCredentials = ProgressiveRequest & { challengeId: string; otp: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function isProgressiveChallengeId(value: unknown): value is string {
  return typeof value === "string" && uuid.test(value);
}
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function parseIntent(input: Record<string, unknown>, confirmation: unknown): ProgressiveRequest | null {
  if (typeof input.phone !== "string" || input.phone.length > 64 ||
      typeof input.organization !== "string" || !input.organization || input.organization.length > 128 ||
      input.organization !== input.organization.trim() || /[\u0000-\u001f\u007f]/.test(input.organization)) return null;
  const phone = normalizeIranianMobile(input.phone);
  if (!phone) return null;
  const common = { phone, organization: input.organization };
  if (input.purpose === "ACCOUNT_SIGN_IN" && (confirmation === undefined || confirmation === false)) return { ...common, purpose: "ACCOUNT_SIGN_IN" };
  if (input.purpose === "ACCOUNT_ENROLL" && confirmation === true) return { ...common, purpose: "ACCOUNT_ENROLL", enrollmentConfirmed: true };
  return null;
}
export function parseProgressiveRequest(value: unknown): ProgressiveRequest | null {
  const input = record(value);
  if (!input || Object.keys(input).some(key => !["phone", "organization", "purpose", "enrollmentConfirmed"].includes(key))) return null;
  return parseIntent(input, input.enrollmentConfirmed);
}
export function parseProgressiveCredentials(value: unknown): ProgressiveCredentials | null {
  const input = record(value);
  if (!input || (input.token !== undefined && input.token !== "") || !isProgressiveChallengeId(input.challengeId) ||
      typeof input.otp !== "string" || input.otp.length > 16) return null;
  const confirmation = input.enrollmentConfirmed === "true" ? true : input.enrollmentConfirmed === "false" ? false : input.enrollmentConfirmed === undefined ? undefined : null;
  const intent = parseIntent(input, confirmation);
  const otp = normalizeDigits(input.otp).trim();
  return intent && /^\d{4}$/.test(otp) ? { ...intent, challengeId: input.challengeId, otp } : null;
}
