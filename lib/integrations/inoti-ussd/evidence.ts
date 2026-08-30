import { createHash } from "node:crypto";

function hashPepper() {
  const pepper = process.env.INOTI_USSD_HASH_PEPPER;
  if (pepper) return pepper;
  if (process.env.NODE_ENV === "production") throw new Error("INOTI_USSD_HASH_PEPPER_REQUIRED");
  return process.env.NEXTAUTH_SECRET || "inoti-ussd-local-test-pepper";
}

export function hashInotiEvidence(value: string) {
  return createHash("sha256").update(hashPepper()).update("\0").update(value).digest("hex");
}

export function maskInotiMobile(mobile: string) {
  return `${mobile.slice(0, 4)}***${mobile.slice(-4)}`;
}
