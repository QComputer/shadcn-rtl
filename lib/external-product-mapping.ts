import "server-only";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";

export const EXTERNAL_SOURCE_CAFELEO = "CAFELEO" as const;

export type ExternalProductMappingInput = {
  organizationId: string;
  externalSource: string;
  externalId: string;
  internalEntityId: string;
};

export type ResolvedExternalProductMapping = {
  id: string;
  organizationId: string;
  externalSource: string;
  externalId: string;
  internalEntityId: string;
  status: string;
};

export async function upsertExternalProductMapping(
  input: ExternalProductMappingInput,
): Promise<ResolvedExternalProductMapping> {
  const mapping = await prisma.externalEntityMapping.upsert({
    where: {
      organizationId_externalSource_externalEntityType_externalId_internalEntityType: {
        organizationId: input.organizationId,
        externalSource: input.externalSource,
        externalEntityType: "PRODUCT",
        externalId: input.externalId,
        internalEntityType: "PRODUCT",
      },
    },
    update: {
      internalEntityId: input.internalEntityId,
      status: "APPROVED",
    },
    create: {
      organizationId: input.organizationId,
      externalSource: input.externalSource,
      externalEntityType: "PRODUCT",
      externalId: input.internalEntityId,
      internalEntityType: "PRODUCT",
      internalEntityId: input.internalEntityId,
      status: "APPROVED",
    },
  });

  return {
    id: mapping.id,
    organizationId: mapping.organizationId,
    externalSource: mapping.externalSource,
    externalId: mapping.externalId,
    internalEntityId: mapping.internalEntityId ?? "",
    status: mapping.status,
  };
}

export async function resolveExternalProductMapping(input: {
  organizationId: string;
  externalSource: string;
  externalId: string;
}): Promise<ResolvedExternalProductMapping | null> {
  const mapping = await prisma.externalEntityMapping.findFirst({
    where: {
      organizationId: input.organizationId,
      externalSource: input.externalSource,
      externalEntityType: "PRODUCT",
      externalId: input.externalId,
      internalEntityType: "PRODUCT",
      status: "APPROVED",
    },
  });

  if (!mapping || !mapping.internalEntityId) return null;

  return {
    id: mapping.id,
    organizationId: mapping.organizationId,
    externalSource: mapping.externalSource,
    externalId: mapping.externalId,
    internalEntityId: mapping.internalEntityId,
    status: mapping.status,
  };
}

export async function resolveExternalProductMappingById(input: {
  organizationId: string;
  externalSource: string;
  externalId: string;
}): Promise<ResolvedExternalProductMapping | null> {
  const mapping = await prisma.externalEntityMapping.findFirst({
    where: {
      organizationId: input.organizationId,
      externalSource: input.externalSource,
      externalEntityType: "PRODUCT",
      externalId: input.externalId,
      internalEntityType: "PRODUCT",
    },
  });

  if (!mapping || !mapping.internalEntityId) return null;

  return {
    id: mapping.id,
    organizationId: mapping.organizationId,
    externalSource: mapping.externalSource,
    externalId: mapping.externalId,
    internalEntityId: mapping.internalEntityId,
    status: mapping.status,
  };
}

export async function listExternalProductMappings(input: {
  organizationId: string;
  externalSource?: string;
}): Promise<ResolvedExternalProductMapping[]> {
  const mappings = await prisma.externalEntityMapping.findMany({
    where: {
      organizationId: input.organizationId,
      externalEntityType: "PRODUCT",
      internalEntityType: "PRODUCT",
      ...(input.externalSource ? { externalSource: input.externalSource } : {}),
    },
    orderBy: { createdAt: "asc" },
  });

  return mappings
    .filter((mapping): mapping is typeof mapping & { internalEntityId: string } =>
      mapping.internalEntityId !== null
    )
    .map((mapping) => ({
      id: mapping.id,
      organizationId: mapping.organizationId,
      externalSource: mapping.externalSource,
      externalId: mapping.externalId,
      internalEntityId: mapping.internalEntityId,
      status: mapping.status,
    }));
}

export async function deactivateExternalProductMapping(input: {
  organizationId: string;
  externalSource: string;
  externalId: string;
}): Promise<void> {
  await prisma.externalEntityMapping.updateMany({
    where: {
      organizationId: input.organizationId,
      externalSource: input.externalSource,
      externalEntityType: "PRODUCT",
      externalId: input.externalId,
      internalEntityType: "PRODUCT",
    },
    data: { status: "REJECTED" },
  });
}

export async function reactivateExternalProductMapping(input: {
  organizationId: string;
  externalSource: string;
  externalId: string;
  internalEntityId: string;
}): Promise<void> {
  await prisma.externalEntityMapping.updateMany({
    where: {
      organizationId: input.organizationId,
      externalSource: input.externalSource,
      externalEntityType: "PRODUCT",
      externalId: input.externalId,
      internalEntityType: "PRODUCT",
    },
    data: {
      status: "APPROVED",
      internalEntityId: input.internalEntityId,
    },
  });
}

export type BulkSyncInput = {
  organizationId: string;
  externalSource: string;
  mappings: Array<{
    externalId: string;
    internalEntityId: string;
  }>;
};

export async function bulkSyncExternalProductMappings(
  input: BulkSyncInput,
): Promise<{ created: number; updated: number; retained: number }> {
  let created = 0;
  let updated = 0;

  for (const mapping of input.mappings) {
    const existing = await prisma.externalEntityMapping.findFirst({
      where: {
        organizationId: input.organizationId,
        externalSource: input.externalSource,
        externalEntityType: "PRODUCT",
        externalId: mapping.externalId,
        internalEntityType: "PRODUCT",
      },
      select: { id: true },
    });

    await prisma.externalEntityMapping.upsert({
      where: {
        organizationId_externalSource_externalEntityType_externalId_internalEntityType: {
          organizationId: input.organizationId,
          externalSource: input.externalSource,
          externalEntityType: "PRODUCT",
          externalId: mapping.externalId,
          internalEntityType: "PRODUCT",
        },
      },
      update: {
        internalEntityId: mapping.internalEntityId,
        status: "APPROVED",
      },
      create: {
        organizationId: input.organizationId,
        externalSource: input.externalSource,
        externalEntityType: "PRODUCT",
        externalId: mapping.externalId,
        internalEntityType: "PRODUCT",
        internalEntityId: mapping.internalEntityId,
        status: "APPROVED",
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  const totalMappings = await prisma.externalEntityMapping.count({
    where: {
      organizationId: input.organizationId,
      externalSource: input.externalSource,
      externalEntityType: "PRODUCT",
      internalEntityType: "PRODUCT",
      status: "APPROVED",
    },
  });

  const retained = totalMappings - input.mappings.length;

  return { created, updated, retained: Math.max(0, retained) };
}

export function assertExternalProductMappingInput(
  input: ExternalProductMappingInput,
): void {
  if (!input.organizationId || typeof input.organizationId !== "string") {
    throw new Error("organizationId is required");
  }
  if (!input.externalSource || typeof input.externalSource !== "string") {
    throw new Error("externalSource is required");
  }
  if (!input.externalId || typeof input.externalId !== "string") {
    throw new Error("externalId is required");
  }
  if (!input.internalEntityId || typeof input.internalEntityId !== "string") {
    throw new Error("internalEntityId is required");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(input.externalId)) {
    throw new Error("externalId must be a safe token");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(input.internalEntityId)) {
    throw new Error("internalEntityId must be a safe token");
  }
}
