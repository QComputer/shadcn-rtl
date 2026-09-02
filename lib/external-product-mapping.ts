import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const PRODUCT_MAPPING_TYPES = {
  externalEntityType: "PRODUCT",
  internalEntityType: "PRODUCT",
} as const;

export type ExternalProductMappingKey = {
  organizationId: string;
  externalSource: string;
  externalId: string;
};

export type ExternalProductMapping = ExternalProductMappingKey & {
  id: string;
  internalEntityId: string;
  status: "APPROVED";
  sourcePresent: boolean;
};

function safeToken(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized || normalized === "." || normalized === ".." || !/^[\p{L}\p{N}][\p{L}\p{N}._:-]*$/u.test(normalized)) {
    throw new Error(`${label} must be a stable safe token`);
  }
  return normalized;
}

export function normalizeExternalProductMappingKey(input: ExternalProductMappingKey): ExternalProductMappingKey {
  return {
    organizationId: safeToken(input.organizationId, "organizationId"),
    externalSource: safeToken(input.externalSource, "externalSource"),
    externalId: safeToken(input.externalId, "externalId"),
  };
}

function metadataObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value } as Record<string, Prisma.JsonValue>
    : {};
}

function toResult(mapping: {
  id: string;
  organizationId: string;
  externalSource: string;
  externalId: string;
  internalEntityId: string | null;
  status: string;
  metadata: Prisma.JsonValue | null;
}): ExternalProductMapping | null {
  if (!mapping.internalEntityId || mapping.status !== "APPROVED") return null;
  const metadata = metadataObject(mapping.metadata);
  return {
    id: mapping.id,
    organizationId: mapping.organizationId,
    externalSource: mapping.externalSource,
    externalId: mapping.externalId,
    internalEntityId: mapping.internalEntityId,
    status: "APPROVED",
    sourcePresent: metadata.sourcePresent !== false,
  };
}

function uniqueWhere(key: ExternalProductMappingKey) {
  return {
    organizationId_externalSource_externalEntityType_externalId_internalEntityType: {
      ...key,
      ...PRODUCT_MAPPING_TYPES,
    },
  };
}

/**
 * Establishes an immutable external-key -> Product.id identity. Existing
 * mappings may be refreshed, but they cannot silently move to another Product.
 */
export async function upsertExternalProductMapping(input: ExternalProductMappingKey & {
  productId: string;
}): Promise<ExternalProductMapping> {
  const key = normalizeExternalProductMappingKey(input);
  const productId = safeToken(input.productId, "productId");

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, organizationId: key.organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw new Error("Mapped Product must belong to the organization");

    const existing = await tx.externalEntityMapping.findUnique({ where: uniqueWhere(key) });
    if (existing?.status === "REJECTED") {
      throw new Error("Rejected mappings require an explicit review decision");
    }
    if (existing?.internalEntityId && existing.internalEntityId !== product.id) {
      throw new Error("External product identity is already bound to another Product");
    }

    const metadata = {
      ...metadataObject(existing?.metadata ?? null),
      sourcePresent: true,
      sourceIdentityKind: "EXPLICIT_STABLE_KEY",
      sourceMissingAt: null,
    } satisfies Prisma.InputJsonObject;
    const mapping = existing
      ? await tx.externalEntityMapping.update({
          where: { id: existing.id },
          data: { internalEntityId: product.id, status: "APPROVED", confidenceScore: 1, metadata },
        })
      : await tx.externalEntityMapping.create({
          data: {
            ...key,
            ...PRODUCT_MAPPING_TYPES,
            internalEntityId: product.id,
            status: "APPROVED",
            confidenceScore: 1,
            metadata,
          },
        });

    return toResult(mapping)!;
  });
}

export async function resolveExternalProductMapping(
  input: ExternalProductMappingKey,
): Promise<ExternalProductMapping | null> {
  const key = normalizeExternalProductMappingKey(input);
  const mapping = await prisma.externalEntityMapping.findUnique({ where: uniqueWhere(key) });
  if (!mapping) return null;
  const result = toResult(mapping);
  if (!result) return null;
  const product = await prisma.product.findFirst({
    where: { id: result.internalEntityId, organizationId: key.organizationId, deletedAt: null },
    select: { id: true },
  });
  return product ? result : null;
}

/** Retains identity while marking that the source snapshot no longer contains it. */
export async function markExternalProductMappingMissing(
  input: ExternalProductMappingKey,
): Promise<ExternalProductMapping | null> {
  const key = normalizeExternalProductMappingKey(input);
  const existing = await prisma.externalEntityMapping.findUnique({ where: uniqueWhere(key) });
  if (!existing) return null;
  const mapping = await prisma.externalEntityMapping.update({
    where: { id: existing.id },
    data: {
      metadata: {
        ...metadataObject(existing.metadata),
        sourcePresent: false,
        sourceMissingAt: new Date().toISOString(),
      },
    },
  });
  return toResult(mapping);
}

/** Reactivates source presence without accepting a replacement Product.id. */
export async function reactivateExternalProductMapping(
  input: ExternalProductMappingKey,
): Promise<ExternalProductMapping> {
  const key = normalizeExternalProductMappingKey(input);
  const existing = await prisma.externalEntityMapping.findUnique({ where: uniqueWhere(key) });
  const result = existing ? toResult(existing) : null;
  if (!existing || !result) throw new Error("Approved external product mapping was not found");
  const product = await prisma.product.findFirst({
    where: { id: result.internalEntityId, organizationId: key.organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw new Error("Mapped Product no longer belongs to the organization");
  const mapping = await prisma.externalEntityMapping.update({
    where: { id: existing.id },
    data: {
      metadata: {
        ...metadataObject(existing.metadata),
        sourcePresent: true,
        sourceMissingAt: null,
      },
    },
  });
  return toResult(mapping)!;
}
