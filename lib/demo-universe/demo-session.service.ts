import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { Prisma, UserRole } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { sanitizeIntegrationConfig } from "@/lib/integrations/organization-integrations";
import {
  DEMO_ROLE_INTERNAL_ROLE,
  type DemoRole,
  requireDemoOrganization,
  requireDemoRole,
} from "@/lib/demo-universe/demo-organization";

function hashDemoToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createDemoSession(input: {
  organizationId: string;
  role: DemoRole;
  ttlMinutes?: number;
  metadata?: unknown;
}) {
  const { demo } = await requireDemoOrganization(input.organizationId);
  requireDemoRole(demo, input.role);
  const internalRole = DEMO_ROLE_INTERNAL_ROLE[input.role];
  const ttlMinutes = Math.min(Math.max(input.ttlMinutes ?? 30, 5), 120);
  const token = randomBytes(32).toString("base64url");
  const session = await prisma.demoSessionToken.create({
    data: {
      organizationId: input.organizationId,
      role: internalRole,
      demoRole: input.role,
      tokenHash: hashDemoToken(token),
      metadata: sanitizeIntegrationConfig(input.metadata) as Prisma.InputJsonObject,
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    },
  });
  return { token, session };
}

export async function verifyDemoSession(input: {
  organizationId: string;
  token: string;
  allowedRoles?: UserRole[];
  allowedDemoRoles?: DemoRole[];
}) {
  const { demo } = await requireDemoOrganization(input.organizationId);
  const session = await prisma.demoSessionToken.findUnique({
    where: { tokenHash: hashDemoToken(input.token) },
  });
  if (
    !session ||
    session.organizationId !== input.organizationId ||
    session.revokedAt ||
    session.expiresAt <= new Date()
  ) {
    throw new ApiError(401, "Invalid demo session");
  }
  const demoRole = session.demoRole ?? session.role;
  requireDemoRole(demo, demoRole);
  if (input.allowedRoles && !input.allowedRoles.includes(session.role)) {
    throw new ApiError(403, "Demo role is not authorized for this action");
  }
  if (input.allowedDemoRoles && !input.allowedDemoRoles.includes(demoRole)) {
    throw new ApiError(403, "Demo role is not authorized for this action");
  }
  await prisma.demoSessionToken.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });
  return session;
}

export async function revokeDemoSession(input: {
  organizationId: string;
  token: string;
}) {
  const session = await prisma.demoSessionToken.findUnique({
    where: { tokenHash: hashDemoToken(input.token) },
  });
  if (!session || session.organizationId !== input.organizationId) throw new ApiError(404, "Demo session not found");
  return prisma.demoSessionToken.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });
}
