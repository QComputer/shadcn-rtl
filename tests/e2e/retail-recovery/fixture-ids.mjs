import { createHash } from "node:crypto";

// Cart mutations validate CUID syntax; readable temporary IDs cannot exercise them.
export function fixtureId(kind, stamp) {
  return `c${createHash("sha256").update(`${kind}:${stamp}`).digest("hex").slice(0, 24)}`;
}
