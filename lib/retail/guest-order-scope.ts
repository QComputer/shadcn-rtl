import { createHash } from "node:crypto";

/** Existing G2 order scope, shared by checkout and explicit claim. */
export function guestOrderScope(organizationSlug: string, sessionId: string) {
  return `retail-order:v1:${createHash("sha256").update(JSON.stringify([organizationSlug, sessionId])).digest("hex")}:`;
}
