import { prisma } from "@/lib/db";
import type { AuditAction } from "@prisma/client";

type AuditLogInput = {
  action: AuditAction;
  entityType: string;
  entityId: string;
  description?: string;
  previousValue?: unknown;
  newValue?: unknown;
  userId?: string | null;
  organizationId?: string | null;
  organizationSlug?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function writeAuditLog(input: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        description: input.description,
        previousValue: input.previousValue === undefined ? undefined : input.previousValue as never,
        newValue: input.newValue === undefined ? undefined : input.newValue as never,
        userId: input.userId || undefined,
        organizationId: input.organizationId || undefined,
        organizationSlug: input.organizationSlug || undefined,
        ipAddress: input.ipAddress || undefined,
        userAgent: input.userAgent || undefined,
      },
    });
  } catch {
    // Audit logging must not break user-facing mutations.
  }
}
