import "server-only";

import type {
  ExternalCatalogItem,
  ExternalCatalogItemType,
  ExternalCatalogProvider,
  InternalBusinessEntityType,
  Prisma,
} from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { normalizeCategorySlug } from "@/lib/category-slugs";
import { normalizeDetailSlug } from "@/lib/detail-slugs";
import { recordBusinessEvent } from "@/lib/integrations/runtime/business-events";
import { sanitizeIntegrationConfig } from "@/lib/integrations/organization-integrations";
import { hasOrganizationCapability } from "@/lib/organization-capabilities";
import { getExternalCatalogConnector } from "@/lib/external-catalog/connectors";

type OrganizationForCatalog = Prisma.OrganizationGetPayload<{
  select: {
    id: true;
    name: true;
    slug: true;
    type: true;
    capabilitiesInitializedAt: true;
    capabilities: { select: { key: true; status: true } };
  };
}>;

function sanitizeJson(input: unknown): Prisma.InputJsonObject {
  return sanitizeIntegrationConfig(input) as Prisma.InputJsonObject;
}

function capabilityInput(organization: OrganizationForCatalog) {
  return {
    legacyType: organization.type,
    capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
    capabilities: organization.capabilities,
  };
}

async function assertOrganization(organizationId: string) {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      capabilitiesInitializedAt: true,
      capabilities: { select: { key: true, status: true } },
    },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  return organization;
}

async function requireConnection(organizationId: string, connectionId: string) {
  const connection = await prisma.externalCatalogConnection.findFirst({
    where: { id: connectionId, organizationId },
  });
  if (!connection) throw new ApiError(404, "External catalog connection not found");
  return connection;
}

function mapExternalTypeToMappingType(type: ExternalCatalogItemType) {
  if (type === "CATEGORY") return "CATEGORY" as const;
  if (type === "PRODUCT") return "PRODUCT" as const;
  if (type === "SERVICE") return "SERVICE" as const;
  return null;
}

function mapExternalTypeToInternalType(type: ExternalCatalogItemType): InternalBusinessEntityType | null {
  if (type === "CATEGORY") return "PRODUCT_CATEGORY";
  if (type === "PRODUCT") return "PRODUCT";
  if (type === "SERVICE") return "SERVICE";
  return null;
}

function readRawNumber(item: ExternalCatalogItem, key: string) {
  const raw = item.rawPayload;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readParentExternalId(item: ExternalCatalogItem) {
  const raw = item.rawPayload;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = (raw as Record<string, unknown>).parentExternalId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function uniqueProductCategorySlug(organizationId: string, source: string) {
  const base = normalizeCategorySlug(source);
  let candidate = base;
  let suffix = 2;
  while (await prisma.productCategory.findFirst({ where: { organizationId, slug: candidate, deletedAt: null }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function uniqueServiceCategorySlug(organizationId: string, source: string) {
  const base = normalizeCategorySlug(source);
  let candidate = base;
  let suffix = 2;
  while (await prisma.serviceCategory.findFirst({ where: { organizationId, slug: candidate, deletedAt: null }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function uniqueDetailSlug(type: "PRODUCT" | "SERVICE", organizationId: string, source: string) {
  const base = normalizeDetailSlug(source);
  let candidate = base;
  let suffix = 2;
  const exists = async (slug: string) => type === "PRODUCT"
    ? prisma.product.findFirst({ where: { organizationId, slug, deletedAt: null }, select: { id: true } })
    : prisma.service.findFirst({ where: { organizationId, slug, deletedAt: null }, select: { id: true } });
  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function upsertBusinessEntity(input: {
  db?: Prisma.TransactionClient;
  organizationId: string;
  entityType: InternalBusinessEntityType;
  entityId: string;
  title: string;
  slug?: string | null;
  metadata?: Prisma.InputJsonObject;
}) {
  const db = input.db ?? prisma;
  return db.businessEntity.upsert({
    where: {
      organizationId_entityType_entityId: {
        organizationId: input.organizationId,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    },
    update: {
      title: input.title,
      slug: input.slug ?? null,
      status: "ACTIVE",
      metadata: input.metadata,
    },
    create: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      title: input.title,
      slug: input.slug ?? null,
      metadata: input.metadata,
    },
  });
}

async function linkImportedBusinessEntity(input: {
  tx: Prisma.TransactionClient;
  organization: OrganizationForCatalog;
  rootEntityId: string;
  entity: {
    entityType: InternalBusinessEntityType;
    entityId: string;
    title: string;
    slug?: string | null;
  };
  relationType: "HAS_CATEGORY" | "HAS_PRODUCT" | "HAS_SERVICE";
  metadata: Prisma.InputJsonObject;
}) {
  const businessEntity = await upsertBusinessEntity({
    db: input.tx,
    organizationId: input.organization.id,
    entityType: input.entity.entityType,
    entityId: input.entity.entityId,
    title: input.entity.title,
    slug: input.entity.slug,
    metadata: input.metadata,
  });
  await input.tx.businessEntityRelation.upsert({
    where: {
      organizationId_sourceEntityId_targetEntityId_relationType: {
        organizationId: input.organization.id,
        sourceEntityId: input.rootEntityId,
        targetEntityId: businessEntity.id,
        relationType: input.relationType,
      },
    },
    update: { metadata: input.metadata },
    create: {
      organizationId: input.organization.id,
      sourceEntityId: input.rootEntityId,
      targetEntityId: businessEntity.id,
      relationType: input.relationType,
      metadata: input.metadata,
    },
  });
  return businessEntity;
}

export async function createExternalCatalogConnection(input: {
  organizationId: string;
  provider: ExternalCatalogProvider;
  externalUrl?: string | null;
  metadata?: unknown;
}) {
  await assertOrganization(input.organizationId);
  const connector = getExternalCatalogConnector(input.provider);
  await connector.validateConnection({ externalUrl: input.externalUrl });
  return prisma.externalCatalogConnection.create({
    data: {
      organizationId: input.organizationId,
      provider: input.provider,
      externalUrl: input.externalUrl ?? null,
      status: "DRAFT",
      syncMode: "MANUAL_APPROVAL",
      metadata: input.metadata ? sanitizeJson(input.metadata) : undefined,
    },
  });
}

export async function listExternalCatalogConnections(input: { organizationId: string }) {
  await assertOrganization(input.organizationId);
  return prisma.externalCatalogConnection.findMany({
    where: { organizationId: input.organizationId },
    include: {
      syncRuns: { orderBy: { startedAt: "desc" }, take: 1 },
      importRuns: { orderBy: { startedAt: "desc" }, take: 1 },
      syncJobs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function previewExternalCatalogImport(input: {
  organizationId: string;
  connectionId: string;
}) {
  await assertOrganization(input.organizationId);
  const connection = await requireConnection(input.organizationId, input.connectionId);
  const connector = getExternalCatalogConnector(connection.provider);
  const preview = await connector.previewCatalog({ externalUrl: connection.externalUrl });
  const run = await prisma.catalogSyncRun.create({
    data: {
      organizationId: input.organizationId,
      connectionId: connection.id,
      status: "PREVIEWED",
      finishedAt: new Date(),
      changesSummary: {
        categories: preview.categories,
        products: preview.products,
        images: preview.images,
        writesToCatalog: 0,
      },
      metadata: { provider: connection.provider, previewOnly: true },
    },
  });
  const importRun = await prisma.externalImportRun.create({
    data: {
      organizationId: input.organizationId,
      connectionId: connection.id,
      status: "PREVIEW",
      finishedAt: new Date(),
      summary: {
        categories: preview.categories,
        products: preview.products,
        images: preview.images,
        writesToCatalog: 0,
      },
    },
  });
  await prisma.externalCatalogItem.deleteMany({ where: { connectionId: connection.id } });
  await prisma.externalCatalogItem.createMany({
    data: preview.items.map((item) => ({
      organizationId: input.organizationId,
      connectionId: connection.id,
      externalId: item.externalId,
      externalType: item.externalType,
      rawName: item.rawName,
      normalizedName: item.rawName.trim(),
      status: "DISCOVERED",
      mappingStatus: "UNMAPPED",
      rawPayload: item as Prisma.InputJsonObject,
      previewPayload: { previewOnly: true, importRunId: importRun.id } as Prisma.InputJsonObject,
    })),
  });
  return { connection, run, importRun, preview };
}

export async function reviewExternalCatalogPreview(input: {
  organizationId: string;
  connectionId: string;
}) {
  await assertOrganization(input.organizationId);
  await requireConnection(input.organizationId, input.connectionId);
  const [items, mappings, importRun] = await Promise.all([
    prisma.externalCatalogItem.findMany({
      where: { organizationId: input.organizationId, connectionId: input.connectionId },
      orderBy: [{ externalType: "asc" }, { rawName: "asc" }],
    }),
    prisma.externalEntityMapping.findMany({
      where: { organizationId: input.organizationId, connectionId: input.connectionId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.externalImportRun.findFirst({
      where: { organizationId: input.organizationId, connectionId: input.connectionId },
      orderBy: { startedAt: "desc" },
    }),
  ]);
  return { items, mappings, importRun };
}

export async function generateExternalCatalogMappings(input: {
  organizationId: string;
  connectionId: string;
}) {
  await assertOrganization(input.organizationId);
  const connection = await requireConnection(input.organizationId, input.connectionId);
  const items = await prisma.externalCatalogItem.findMany({
    where: {
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      externalType: { in: ["CATEGORY", "PRODUCT", "SERVICE"] },
      status: { notIn: ["REJECTED", "IMPORTED"] },
    },
  });
  const mappings = [];
  for (const item of items) {
    const externalEntityType = mapExternalTypeToMappingType(item.externalType);
    const internalEntityType = mapExternalTypeToInternalType(item.externalType);
    if (!externalEntityType || !internalEntityType) continue;
    const mapping = await prisma.externalEntityMapping.upsert({
      where: {
        organizationId_externalSource_externalEntityType_externalId_internalEntityType: {
          organizationId: input.organizationId,
          externalSource: connection.provider,
          externalEntityType,
          externalId: item.externalId,
          internalEntityType,
        },
      },
      update: {
        connectionId: connection.id,
        externalItemId: item.id,
        status: "SUGGESTED",
        confidenceScore: 0.8500,
        metadata: { generatedBy: "mock-catalog-mapper", provider: connection.provider },
      },
      create: {
        organizationId: input.organizationId,
        connectionId: connection.id,
        externalItemId: item.id,
        externalSource: connection.provider,
        externalEntityType,
        externalId: item.externalId,
        internalEntityType,
        confidenceScore: 0.8500,
        metadata: { generatedBy: "mock-catalog-mapper", provider: connection.provider },
      },
    });
    mappings.push(mapping);
  }
  await prisma.externalCatalogItem.updateMany({
    where: { id: { in: mappings.map((mapping) => mapping.externalItemId).filter((id): id is string => Boolean(id)) } },
    data: { status: "MAPPED", mappingStatus: "MATCHED" },
  });
  await prisma.externalImportRun.create({
    data: {
      organizationId: input.organizationId,
      connectionId: connection.id,
      status: "MAPPING",
      finishedAt: new Date(),
      summary: { mappings: mappings.length },
    },
  });
  return { mappings };
}

export async function approveExternalCatalogItems(input: {
  organizationId: string;
  connectionId: string;
  itemIds?: string[];
}) {
  await assertOrganization(input.organizationId);
  const connection = await requireConnection(input.organizationId, input.connectionId);
  const items = await prisma.externalCatalogItem.findMany({
    where: {
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      externalType: { in: ["CATEGORY", "PRODUCT", "SERVICE"] },
      ...(input.itemIds?.length ? { id: { in: input.itemIds } } : {}),
    },
  });
  if (items.length === 0) throw new ApiError(400, "No external catalog items available for approval");
  await generateExternalCatalogMappings({ organizationId: input.organizationId, connectionId: input.connectionId });
  const approvedAt = new Date();
  await prisma.externalCatalogItem.updateMany({
    where: { id: { in: items.map((item) => item.id) }, organizationId: input.organizationId },
    data: { status: "APPROVED", mappingStatus: "READY_FOR_IMPORT", approvedAt, rejectedAt: null },
  });
  await prisma.externalEntityMapping.updateMany({
    where: {
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      externalId: { in: items.map((item) => item.externalId) },
    },
    data: { status: "APPROVED" },
  });
  const run = await prisma.externalImportRun.create({
    data: {
      organizationId: input.organizationId,
      connectionId: connection.id,
      status: "READY_FOR_APPROVAL",
      approvedAt,
      finishedAt: approvedAt,
      summary: { approvedItems: items.length },
    },
  });
  return { approvedItems: items.length, run };
}

export async function rejectExternalCatalogItems(input: {
  organizationId: string;
  connectionId: string;
  itemIds: string[];
}) {
  await assertOrganization(input.organizationId);
  await requireConnection(input.organizationId, input.connectionId);
  if (input.itemIds.length === 0) throw new ApiError(400, "At least one item is required");
  const rejectedAt = new Date();
  const result = await prisma.externalCatalogItem.updateMany({
    where: { id: { in: input.itemIds }, organizationId: input.organizationId, connectionId: input.connectionId },
    data: { status: "REJECTED", mappingStatus: "IGNORED", rejectedAt },
  });
  await prisma.externalEntityMapping.updateMany({
    where: { organizationId: input.organizationId, connectionId: input.connectionId, externalItemId: { in: input.itemIds } },
    data: { status: "REJECTED" },
  });
  return { rejectedItems: result.count };
}

async function findOrCreateFallbackProductCategory(organization: OrganizationForCatalog, tx: Prisma.TransactionClient) {
  const existing = await tx.productCategory.findFirst({
    where: { organizationId: organization.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return tx.productCategory.create({
    data: {
      organizationId: organization.id,
      organizationSlug: organization.slug,
      name: "واردشده",
      slug: await uniqueProductCategorySlug(organization.id, "واردشده"),
      isActive: true,
    },
  });
}

async function findOrCreateFallbackServiceCategory(organization: OrganizationForCatalog, tx: Prisma.TransactionClient) {
  const existing = await tx.serviceCategory.findFirst({
    where: { organizationId: organization.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return tx.serviceCategory.create({
    data: {
      organizationId: organization.id,
      name: "واردشده",
      slug: await uniqueServiceCategorySlug(organization.id, "واردشده"),
      isActive: true,
    },
  });
}

async function importCategory(input: {
  organization: OrganizationForCatalog;
  item: ExternalCatalogItem;
  tx: Prisma.TransactionClient;
}) {
  const mapping = await input.tx.externalEntityMapping.findFirst({
    where: { organizationId: input.organization.id, externalItemId: input.item.id, status: "APPROVED" },
  });
  if (mapping?.internalEntityId) {
    const updated = await input.tx.productCategory.update({
      where: { id: mapping.internalEntityId },
      data: { name: input.item.normalizedName || input.item.rawName },
    });
    return { entityType: "PRODUCT_CATEGORY" as const, entityId: updated.id, title: updated.name, slug: updated.slug };
  }
  const category = await input.tx.productCategory.create({
    data: {
      organizationId: input.organization.id,
      organizationSlug: input.organization.slug,
      name: input.item.normalizedName || input.item.rawName,
      slug: await uniqueProductCategorySlug(input.organization.id, input.item.normalizedName || input.item.rawName),
      isActive: true,
    },
  });
  await input.tx.externalEntityMapping.updateMany({
    where: { organizationId: input.organization.id, externalItemId: input.item.id, status: "APPROVED" },
    data: { internalEntityId: category.id },
  });
  return { entityType: "PRODUCT_CATEGORY" as const, entityId: category.id, title: category.name, slug: category.slug };
}

async function importProduct(input: {
  organization: OrganizationForCatalog;
  item: ExternalCatalogItem;
  categoryIdByExternalId: Map<string, string>;
  tx: Prisma.TransactionClient;
}) {
  const mapping = await input.tx.externalEntityMapping.findFirst({
    where: { organizationId: input.organization.id, externalItemId: input.item.id, status: "APPROVED" },
  });
  const price = readRawNumber(input.item, "price") ?? 0;
  if (mapping?.internalEntityId) {
    const updated = await input.tx.product.update({
      where: { id: mapping.internalEntityId },
      data: { name: input.item.normalizedName || input.item.rawName, basePrice: price },
    });
    return { entityType: "PRODUCT" as const, entityId: updated.id, title: updated.name, slug: updated.slug };
  }
  const parentExternalId = readParentExternalId(input.item);
  const fallbackCategory = parentExternalId ? null : await findOrCreateFallbackProductCategory(input.organization, input.tx);
  const categoryId = parentExternalId ? input.categoryIdByExternalId.get(parentExternalId) : fallbackCategory?.id;
  if (!categoryId) throw new ApiError(409, `No approved category mapping found for ${input.item.externalId}`);
  const product = await input.tx.product.create({
    data: {
      organizationId: input.organization.id,
      organizationSlug: input.organization.slug,
      categoryId,
      name: input.item.normalizedName || input.item.rawName,
      slug: await uniqueDetailSlug("PRODUCT", input.organization.id, input.item.normalizedName || input.item.rawName),
      basePrice: price,
      trackInventory: false,
      isActive: true,
    },
  });
  await input.tx.productVariant.create({
    data: {
      productId: product.id,
      name: "Default",
      price: product.basePrice,
      inventory: 1000,
      allowBackOrder: true,
    },
  });
  await input.tx.externalEntityMapping.updateMany({
    where: { organizationId: input.organization.id, externalItemId: input.item.id, status: "APPROVED" },
    data: { internalEntityId: product.id },
  });
  return { entityType: "PRODUCT" as const, entityId: product.id, title: product.name, slug: product.slug };
}

async function importService(input: {
  organization: OrganizationForCatalog;
  item: ExternalCatalogItem;
  tx: Prisma.TransactionClient;
}) {
  const mapping = await input.tx.externalEntityMapping.findFirst({
    where: { organizationId: input.organization.id, externalItemId: input.item.id, status: "APPROVED" },
  });
  const price = readRawNumber(input.item, "price") ?? 0;
  if (mapping?.internalEntityId) {
    const updated = await input.tx.service.update({
      where: { id: mapping.internalEntityId },
      data: {
        name: input.item.normalizedName || input.item.rawName,
        price,
        duration: readRawNumber(input.item, "duration") ?? 30,
      },
    });
    return { entityType: "SERVICE" as const, entityId: updated.id, title: updated.name, slug: updated.slug };
  }
  const category = await findOrCreateFallbackServiceCategory(input.organization, input.tx);
  const service = await input.tx.service.create({
    data: {
      organizationId: input.organization.id,
      categoryId: category.id,
      name: input.item.normalizedName || input.item.rawName,
      slug: await uniqueDetailSlug("SERVICE", input.organization.id, input.item.normalizedName || input.item.rawName),
      price,
      duration: readRawNumber(input.item, "duration") ?? 30,
      isActive: true,
    },
  });
  await input.tx.externalEntityMapping.updateMany({
    where: { organizationId: input.organization.id, externalItemId: input.item.id, status: "APPROVED" },
    data: { internalEntityId: service.id },
  });
  return { entityType: "SERVICE" as const, entityId: service.id, title: service.name, slug: service.slug };
}

export async function executeApprovedExternalCatalogImport(input: {
  organizationId: string;
  connectionId: string;
  demo?: boolean;
}) {
  const organization = await assertOrganization(input.organizationId);
  const connection = await requireConnection(input.organizationId, input.connectionId);
  const approvedItems = await prisma.externalCatalogItem.findMany({
    where: {
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      status: "APPROVED",
      externalType: { in: ["CATEGORY", "PRODUCT", "SERVICE"] },
    },
    orderBy: [{ externalType: "asc" }, { rawName: "asc" }],
  });
  if (approvedItems.length === 0) throw new ApiError(409, "No approved external catalog items are ready to import");

  const wantsShop = approvedItems.some((item) => item.externalType === "CATEGORY" || item.externalType === "PRODUCT");
  const wantsAppointment = approvedItems.some((item) => item.externalType === "SERVICE");
  if (wantsShop && !hasOrganizationCapability(capabilityInput(organization), "SHOP")) {
    throw new ApiError(409, "SHOP capability is required to import product catalog items");
  }
  if (wantsAppointment && !hasOrganizationCapability(capabilityInput(organization), "APPOINTMENT")) {
    throw new ApiError(409, "APPOINTMENT capability is required to import service catalog items");
  }

  const importRun = await prisma.externalImportRun.create({
    data: {
      organizationId: input.organizationId,
      connectionId: connection.id,
      status: "IMPORTING",
      summary: { approvedItems: approvedItems.length },
    },
  });

  try {
    const imported = await prisma.$transaction(async (tx) => {
      const categoryIdByExternalId = new Map<string, string>();
      const result: Array<{ itemId: string; entityType: InternalBusinessEntityType; entityId: string; title: string }> = [];
      const categories = approvedItems.filter((item) => item.externalType === "CATEGORY");
      const products = approvedItems.filter((item) => item.externalType === "PRODUCT");
      const services = approvedItems.filter((item) => item.externalType === "SERVICE");
      const rootEntity = await upsertBusinessEntity({
        db: tx,
        organizationId: organization.id,
        entityType: "ORGANIZATION",
        entityId: organization.id,
        title: organization.name,
        slug: organization.slug,
        metadata: { externalCatalogConnectionId: connection.id, sourceModel: "Organization" },
      });

      for (const item of categories) {
        const entity = await importCategory({ organization, item, tx });
        categoryIdByExternalId.set(item.externalId, entity.entityId);
        await linkImportedBusinessEntity({
          tx,
          organization,
          rootEntityId: rootEntity.id,
          entity,
          relationType: "HAS_CATEGORY",
          metadata: { externalCatalogConnectionId: connection.id, externalId: item.externalId },
        });
        await tx.externalCatalogItem.update({
          where: { id: item.id },
          data: { status: "IMPORTED", mappingStatus: "IMPORTED", importedAt: new Date(), importedEntityType: entity.entityType, importedEntityId: entity.entityId },
        });
        result.push({ itemId: item.id, ...entity });
      }

      for (const item of products) {
        const entity = await importProduct({ organization, item, categoryIdByExternalId, tx });
        await linkImportedBusinessEntity({
          tx,
          organization,
          rootEntityId: rootEntity.id,
          entity,
          relationType: "HAS_PRODUCT",
          metadata: { externalCatalogConnectionId: connection.id, externalId: item.externalId },
        });
        await tx.externalCatalogItem.update({
          where: { id: item.id },
          data: { status: "IMPORTED", mappingStatus: "IMPORTED", importedAt: new Date(), importedEntityType: entity.entityType, importedEntityId: entity.entityId },
        });
        result.push({ itemId: item.id, ...entity });
      }

      for (const item of services) {
        const entity = await importService({ organization, item, tx });
        await linkImportedBusinessEntity({
          tx,
          organization,
          rootEntityId: rootEntity.id,
          entity,
          relationType: "HAS_SERVICE",
          metadata: { externalCatalogConnectionId: connection.id, externalId: item.externalId },
        });
        await tx.externalCatalogItem.update({
          where: { id: item.id },
          data: { status: "IMPORTED", mappingStatus: "IMPORTED", importedAt: new Date(), importedEntityType: entity.entityType, importedEntityId: entity.entityId },
        });
        result.push({ itemId: item.id, ...entity });
      }
      return result;
    });

    const completedAt = new Date();
    await prisma.externalImportRun.update({
      where: { id: importRun.id },
      data: {
        status: "COMPLETED",
        finishedAt: completedAt,
        importedAt: completedAt,
        summary: { approvedItems: approvedItems.length, importedItems: imported.length, demoOnly: input.demo === true },
      },
    });
    await recordBusinessEvent({
      organizationId: organization.id,
      type: "INTEGRATION_CONNECTED",
      entityType: "ExternalCatalogImport",
      entityId: importRun.id,
      payload: { importedItems: imported.length, provider: connection.provider },
      metadata: { demoUniverse: input.demo === true, externalProviderCalled: false, noExternalMutation: true },
    });
    return { importRun: { ...importRun, status: "COMPLETED" as const }, imported };
  } catch (error) {
    await prisma.externalImportRun.update({
      where: { id: importRun.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "External catalog import failed",
      },
    });
    throw error;
  }
}

export async function runExternalCatalogSyncDryRun(input: {
  organizationId: string;
  connectionId: string;
  entityType?: "CATEGORY" | "PRODUCT" | "SERVICE";
}) {
  const organization = await assertOrganization(input.organizationId);
  const connection = await requireConnection(input.organizationId, input.connectionId);
  const connector = getExternalCatalogConnector(connection.provider);
  const currentProducts = await prisma.product.findMany({
    where: { organizationId: input.organizationId, deletedAt: null },
    select: { name: true, basePrice: true },
  });
  const currentServices = await prisma.service.findMany({
    where: { organizationId: input.organizationId, deletedAt: null },
    select: { name: true, price: true },
  });
  const changes = await connector.compareChanges({
    externalUrl: connection.externalUrl,
    currentItems: [
      ...currentProducts.map((product) => ({ name: product.name, price: Number(product.basePrice) })),
      ...currentServices.map((service) => ({ name: service.name, price: Number(service.price) })),
    ],
  });
  const filteredChanges = input.entityType
    ? changes.filter((change) => change.externalType === input.entityType)
    : changes;
  const job = await prisma.externalCatalogSyncJob.create({
    data: {
      organizationId: organization.id,
      connectionId: connection.id,
      source: connection.provider,
      entityType: input.entityType ?? "PRODUCT",
      status: "DRY_RUN_COMPLETED",
      dryRun: true,
      finishedAt: new Date(),
      resultSummary: {
        changes: filteredChanges as unknown as Prisma.InputJsonArray,
        counts: filteredChanges.reduce<Record<string, number>>((acc, change) => {
          acc[change.changeType] = (acc[change.changeType] ?? 0) + 1;
          return acc;
        }, {}),
        externalProviderCalled: false,
      },
    },
  });
  return { job, changes: filteredChanges };
}
