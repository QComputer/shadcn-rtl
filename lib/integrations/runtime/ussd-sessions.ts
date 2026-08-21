import "server-only";

import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import { recordCustomerInteraction, resolveCustomerIdentity } from "@/lib/customer-identity/customer-identity.service";
import prisma from "@/lib/db";
import { recordBusinessEvent } from "@/lib/integrations/runtime/business-events";
import { executeIntegrationRuntimeAction } from "@/lib/integrations/runtime/service";
import { sanitizeIntegrationConfig } from "@/lib/integrations/organization-integrations";

function assertHash(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new ApiError(400, "USSD session identifier must be a SHA-256 hash");
  }
}

export async function startUssdSession(input: {
  organizationId: string;
  integrationId: string;
  sessionIdHash: string;
  customerIdentityId?: string | null;
  customerId?: string | null;
  guestCustomerId?: string | null;
  phone?: string | null;
  metadata?: unknown;
}) {
  assertHash(input.sessionIdHash);

  const integration = await prisma.organizationIntegration.findFirst({
    where: {
      id: input.integrationId,
      organizationId: input.organizationId,
      type: "USSD",
    },
    select: { id: true, organizationId: true, status: true },
  });
  if (!integration) throw new ApiError(404, "USSD integration not found");
  if (integration.status !== "ACTIVE") throw new ApiError(409, "USSD integration must be ACTIVE");

  await executeIntegrationRuntimeAction({
    organizationId: input.organizationId,
    integrationId: input.integrationId,
    action: "USSD_SESSION_START",
  });

  const customerIdentity = input.customerIdentityId
    ? await prisma.customerIdentity.findFirst({
        where: { id: input.customerIdentityId, organizationId: input.organizationId },
        select: { id: true },
      })
    : input.phone || input.customerId || input.guestCustomerId
      ? await resolveCustomerIdentity({
          organizationId: input.organizationId,
          userId: input.customerId,
          guestCustomerId: input.guestCustomerId,
          phone: input.phone,
          metadata: { source: "ussd-session" },
        })
      : null;
  if (input.customerIdentityId && !customerIdentity) throw new ApiError(404, "Customer identity not found");

  const metadata = sanitizeIntegrationConfig(input.metadata) as Prisma.InputJsonObject;
  const session = await prisma.ussdSession.upsert({
    where: {
      integrationId_sessionIdHash: {
        integrationId: input.integrationId,
        sessionIdHash: input.sessionIdHash,
      },
    },
    create: {
      organizationId: input.organizationId,
      integrationId: input.integrationId,
      customerIdentityId: customerIdentity?.id ?? null,
      sessionIdHash: input.sessionIdHash,
      customerId: input.customerId ?? null,
      guestCustomerId: input.guestCustomerId ?? null,
      status: "STARTED",
      state: {},
      metadata,
    },
    update: {
      status: "ACTIVE",
      customerIdentityId: customerIdentity?.id ?? undefined,
      lastSeenAt: new Date(),
      metadata,
    },
  });

  const businessEvent = await recordBusinessEvent({
    organizationId: input.organizationId,
    integrationId: input.integrationId,
    customerIdentityId: customerIdentity?.id ?? null,
    type: "USSD_SESSION_STARTED",
    entityType: "UssdSession",
    entityId: session.id,
    dedupeKey: `ussd-session-started:${input.integrationId}:${input.sessionIdHash}`,
    payload: {
      sessionPublicId: session.publicId,
      status: session.status,
    },
    metadata: { dryRun: true },
  });

  if (customerIdentity) {
    await recordCustomerInteraction({
      organizationId: input.organizationId,
      customerIdentityId: customerIdentity.id,
      integrationId: input.integrationId,
      businessEventId: businessEvent.id,
      type: "USSD_SESSION_STARTED",
      entityType: "UssdSession",
      entityId: session.id,
      summary: "USSD session started",
      metadata: { dryRun: true },
    });
  }

  return session;
}
