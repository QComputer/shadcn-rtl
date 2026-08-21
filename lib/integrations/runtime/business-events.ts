import "server-only";

import type { BusinessEventType, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { sanitizeIntegrationConfig } from "@/lib/integrations/organization-integrations";

function sanitizePayload(input: unknown): Prisma.InputJsonObject {
  return sanitizeIntegrationConfig(input) as Prisma.InputJsonObject;
}

async function assertOrganization(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
}

async function assertIntegrationBelongsToOrganization(organizationId: string, integrationId?: string | null) {
  if (!integrationId) return;
  const integration = await prisma.organizationIntegration.findFirst({
    where: { id: integrationId, organizationId },
    select: { id: true },
  });
  if (!integration) throw new ApiError(404, "Integration not found");
}

async function assertCustomerIdentityBelongsToOrganization(organizationId: string, customerIdentityId?: string | null) {
  if (!customerIdentityId) return;
  const customerIdentity = await prisma.customerIdentity.findFirst({
    where: { id: customerIdentityId, organizationId },
    select: { id: true },
  });
  if (!customerIdentity) throw new ApiError(404, "Customer identity not found");
}

export async function recordBusinessEvent(input: {
  organizationId: string;
  integrationId?: string | null;
  customerIdentityId?: string | null;
  type: BusinessEventType;
  dedupeKey?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload?: unknown;
  metadata?: unknown;
  occurredAt?: Date;
}) {
  await assertOrganization(input.organizationId);
  await assertIntegrationBelongsToOrganization(input.organizationId, input.integrationId);
  await assertCustomerIdentityBelongsToOrganization(input.organizationId, input.customerIdentityId);

  return prisma.businessEvent.create({
    data: {
      organizationId: input.organizationId,
      integrationId: input.integrationId ?? null,
      customerIdentityId: input.customerIdentityId ?? null,
      type: input.type,
      dedupeKey: input.dedupeKey ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      payload: sanitizePayload(input.payload),
      metadata: sanitizePayload(input.metadata),
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
}

export async function listBusinessEventsForOrganization(input: {
  organizationId: string;
  limit?: number;
}) {
  await assertOrganization(input.organizationId);
  return prisma.businessEvent.findMany({
    where: { organizationId: input.organizationId },
    orderBy: { occurredAt: "desc" },
    take: Math.min(Math.max(input.limit ?? 50, 1), 100),
  });
}
