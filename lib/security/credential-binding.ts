import { createHmac, timingSafeEqual } from "node:crypto";

/** A server-keyed credential version. Never expose the password hash in a JWT. */
export function credentialBinding(userId: string, passwordHash: string, secret: string): string {
  if (!secret) throw new Error("Session security secret is required");
  return createHmac("sha256", secret).update(JSON.stringify(["credential-v1", userId, passwordHash])).digest("hex");
}

export function sameCredentialBinding(value: unknown, expected: string): boolean {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) &&
    timingSafeEqual(Buffer.from(value, "hex"), Buffer.from(expected, "hex"));
}
