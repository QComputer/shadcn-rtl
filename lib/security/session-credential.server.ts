import "server-only";
import { prisma } from "@/lib/db-runtime";
import { credentialBinding, sameCredentialBinding } from "./credential-binding";
import type { JWT } from "next-auth/jwt";
import { checkRateLimit } from "@/lib/rate-limit";

async function rejected(userId: string) {
  if (checkRateLimit({ key: `revoked-session-audit:${userId}`, limit: 1, windowMs: 15 * 60_000 }).allowed) {
    try { await prisma.auditLog.create({ data: { action: "UPDATE", entityType: "SessionAccessRejected", entityId: userId,
      userId, description: "Stale session credential rejected; no token or credential data recorded" } }); } catch { /* Denial remains authoritative if audit storage fails. */ }
  }
  return null;
}

export async function validateSessionCredential(token: JWT, secret: string) {
  if (typeof token.id !== "string") return null;
  const user = await prisma.user.findFirst({ where: { id: token.id, isActive: true, deletedAt: null },
    select: { id: true, password: true, role: true } });
  if (!user) return null;
  const binding = credentialBinding(user.id, user.password, secret);
  if (token.credentialBinding !== undefined) {
    return sameCredentialBinding(token.credentialBinding, binding) ? { user, binding } : rejected(user.id);
  }
  // Preserve unmodified legacy sessions without allowing an old token to
  // acquire the new credential version after a password change/reset.
  if (typeof token.iat !== "number" || !Number.isFinite(token.iat)) return null;
  const since = new Date(Math.floor(token.iat) * 1000);
  const changed = await prisma.auditLog.findFirst({ where: { entityId: user.id, createdAt: { gte: since },
    OR: [{ action: "RESET_PASSWORD", entityType: "User" },
      { action: "UPDATE", entityType: "OrganizationAccountCredential" }] }, select: { id: true } });
  if (changed) return rejected(user.id);
  return { user, binding };
}
