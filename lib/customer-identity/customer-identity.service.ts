import "server-only";

import { createHash } from "node:crypto";
import type { CustomerInteractionType, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { sanitizeIntegrationConfig } from "@/lib/integrations/organization-integrations";
import { normalizeIranianMobile } from "@/lib/sms/phone-normalization";

function sanitizeJson(input: unknown): Prisma.InputJsonObject {
  return sanitizeIntegrationConfig(input) as Prisma.InputJsonObject;
}

export function normalizeCustomerPhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value
    .trim()
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[\s-]/g, "");
  if (/^09\d{9}$/.test(digits)) return digits;
  return normalizeIranianMobile(digits);
}

export function hashCustomerIdentifier(organizationId: string, value: string) {
  return createHash("sha256").update(`${organizationId}:${value}`).digest("hex");
}

function normalizeEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  return email || null;
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

async function assertBusinessEventBelongsToOrganization(organizationId: string, businessEventId?: string | null) {
  if (!businessEventId) return;
  const businessEvent = await prisma.businessEvent.findFirst({
    where: { id: businessEventId, organizationId },
    select: { id: true },
  });
  if (!businessEvent) throw new ApiError(404, "Business event not found");
}

export async function resolveCustomerIdentity(input: {
  organizationId: string;
  userId?: string | null;
  guestCustomerId?: string | null;
  phone?: string | null;
  email?: string | null;
  externalIdentifiers?: unknown;
  metadata?: unknown;
}) {
  await assertOrganization(input.organizationId);

  const phone = normalizeCustomerPhone(input.phone);
  const phoneHash = phone ? hashCustomerIdentifier(input.organizationId, phone) : null;
  const email = normalizeEmail(input.email);

  if (input.phone && !phone) {
    throw new ApiError(400, "Customer phone must be a valid Iranian mobile number");
  }

  const lookup = [
    phoneHash ? { phoneHash } : null,
    email ? { email } : null,
    input.userId ? { userId: input.userId } : null,
    input.guestCustomerId ? { guestCustomerId: input.guestCustomerId } : null,
  ].filter((condition): condition is Exclude<typeof condition, null> => condition !== null);

  if (lookup.length === 0) {
    throw new ApiError(400, "Customer identity requires a phone, email, user, or guest customer");
  }

  const existing = await prisma.customerIdentity.findFirst({
    where: {
      organizationId: input.organizationId,
      OR: lookup,
    },
  });

  if (existing) {
    return prisma.customerIdentity.update({
      where: { id: existing.id },
      data: {
        phone: existing.phone ?? phone,
        phoneHash: existing.phoneHash ?? phoneHash,
        email: existing.email ?? email,
        userId: existing.userId ?? input.userId ?? null,
        guestCustomerId: existing.guestCustomerId ?? input.guestCustomerId ?? null,
        externalIdentifiers: existing.externalIdentifiers ?? (input.externalIdentifiers ? sanitizeJson(input.externalIdentifiers) : undefined),
        metadata: input.metadata ? sanitizeJson(input.metadata) : existing.metadata ?? undefined,
      },
    });
  }

  return prisma.customerIdentity.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      guestCustomerId: input.guestCustomerId ?? null,
      phone,
      phoneHash,
      email,
      externalIdentifiers: input.externalIdentifiers ? sanitizeJson(input.externalIdentifiers) : undefined,
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
  });
}

export async function getCustomerIdentity(input: {
  organizationId: string;
  customerIdentityId: string;
}) {
  await assertOrganization(input.organizationId);
  const customerIdentity = await prisma.customerIdentity.findFirst({
    where: { id: input.customerIdentityId, organizationId: input.organizationId },
  });
  if (!customerIdentity) throw new ApiError(404, "Customer identity not found");
  return customerIdentity;
}

export async function recordCustomerInteraction(input: {
  organizationId: string;
  customerIdentityId: string;
  integrationId?: string | null;
  businessEventId?: string | null;
  type: CustomerInteractionType;
  entityType?: string | null;
  entityId?: string | null;
  summary?: string | null;
  metadata?: unknown;
  occurredAt?: Date;
}) {
  await assertOrganization(input.organizationId);
  await assertCustomerIdentityBelongsToOrganization(input.organizationId, input.customerIdentityId);
  await assertIntegrationBelongsToOrganization(input.organizationId, input.integrationId);
  await assertBusinessEventBelongsToOrganization(input.organizationId, input.businessEventId);

  return prisma.customerInteraction.create({
    data: {
      organizationId: input.organizationId,
      customerIdentityId: input.customerIdentityId,
      integrationId: input.integrationId ?? null,
      businessEventId: input.businessEventId ?? null,
      type: input.type,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      summary: input.summary ?? null,
      metadata: sanitizeJson(input.metadata),
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
}

export async function listCustomerInteractions(input: {
  organizationId: string;
  customerIdentityId: string;
  limit?: number;
}) {
  await assertOrganization(input.organizationId);
  await assertCustomerIdentityBelongsToOrganization(input.organizationId, input.customerIdentityId);

  return prisma.customerInteraction.findMany({
    where: {
      organizationId: input.organizationId,
      customerIdentityId: input.customerIdentityId,
    },
    orderBy: { occurredAt: "desc" },
    take: Math.min(Math.max(input.limit ?? 50, 1), 100),
  });
}
