import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import type { TenantContext } from "@/lib/tenant-context";

const mockState = {
  productExists: true,
  definitions: new Map<string, { id: string; key: string; label: string; scope?: string; valueType: string; allowedValues: unknown }>(),
  existing: [] as Array<{ id: string; optionValues: Array<{ definitionId: string; valueText: string | null; valueNumber: { toString(): string } | null; valueBoolean: boolean | null }> }>,
};

const prismaMock = {
  product: { findFirst: async () => mockState.productExists ? { id: "product-000001", name: "Mock product" } : null },
  retailAttributeDefinition: { findFirst: async ({ where }: { where: { id: string } }) => mockState.definitions.get(where.id) ?? null },
  productVariant: { findMany: async ({ where }: { where: { productId?: string } }) => where.productId ? mockState.existing : [] },
};
(globalThis as unknown as { bazarBazPrisma?: PrismaClient }).bazarBazPrisma = prismaMock as unknown as PrismaClient;

const context = { organizationId: "org-1", organizationSlug: "store-one" } as TenantContext;

function rangeInput(overrides: Record<string, unknown> = {}) {
  return { sizeDefinitionId: "size-def", sizeMode: "RANGE", sizeStart: 35, sizeEnd: 36, sizeStep: 0.5, ...overrides };
}

test("range schema accepts half-size endpoints and rejects invalid steps or range values", async () => {
  const { variantGenerationSchema } = await import("@/lib/retail/merchant-catalog.server");
  assert.equal(variantGenerationSchema.safeParse(rangeInput()).success, true);
  assert.equal(variantGenerationSchema.safeParse(rangeInput({ sizeStart: 35.5, sizeEnd: 36.5 })).success, true);
  assert.equal(variantGenerationSchema.safeParse(rangeInput({ sizeStep: 0.25 })).success, false);
  assert.equal(variantGenerationSchema.safeParse(rangeInput({ sizeStep: 4 })).success, false);
  assert.equal(variantGenerationSchema.safeParse(rangeInput({ sizeStart: 0 })).success, false);
  assert.equal(variantGenerationSchema.safeParse(rangeInput({ sizeEnd: 1000 })).success, false);
  assert.equal(variantGenerationSchema.safeParse(rangeInput({ sizeStart: 37, sizeEnd: 36 })).success, false);
});

test("preview deduplicates requested combinations and existing variants", async () => {
  const { variantGenerationSchema, previewRetailVariantGeneration } = await import("@/lib/retail/merchant-catalog.server");
  mockState.productExists = true;
  mockState.definitions = new Map([["size-def", { id: "size-def", key: "size", label: "Size", scope: "VARIANT_OPTION", valueType: "NUMBER", allowedValues: null }]]);
  mockState.existing = [{ id: "existing-variant", optionValues: [{ definitionId: "size-def", valueText: null, valueNumber: { toString: () => "35.5" }, valueBoolean: null }] }];

  const result = await previewRetailVariantGeneration(context, "product-000001", variantGenerationSchema.parse(rangeInput({ sizeStart: 35, sizeEnd: 36, sizeStep: 0.5 })));
  assert.equal(result.existing, 1);
  assert.equal(result.toAdd, 2);
  assert.deepEqual(result.canCreate.map(item => item.options[0]?.value), [35, 36]);
  assert.deepEqual(result.errors, []);
});

test("preview reports missing tenant product or attribute definitions", async () => {
  const { variantGenerationSchema, previewRetailVariantGeneration } = await import("@/lib/retail/merchant-catalog.server");
  mockState.productExists = false;
  await assert.rejects(() => previewRetailVariantGeneration(context, "missing", variantGenerationSchema.parse(rangeInput())), (error: unknown) => typeof error === "object" && error !== null && "status" in error && error.status === 404);

  mockState.productExists = true;
  mockState.definitions = new Map();
  mockState.existing = [];
  const result = await previewRetailVariantGeneration(context, "product-000001", variantGenerationSchema.parse(rangeInput()));
  assert.deepEqual(result.errors, ["Size attribute not found or belongs to another store.", "Either a size or color definition must be provided."]);
  assert.equal(result.toAdd, 0);
});

test("preview accepts custom Persian color names for recognized color ENUM definitions and deduplicates them", async () => {
  const { variantGenerationSchema, previewRetailVariantGeneration } = await import("@/lib/retail/merchant-catalog.server");
  mockState.productExists = true;
  mockState.definitions = new Map([
    ["size-def", { id: "size-def", key: "size", label: "سایز", scope: "VARIANT_OPTION", valueType: "TEXT", allowedValues: null }],
    ["color-def", { id: "color-def", key: "shoe_color", label: "رنگ کفش", scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: ["مشکی"] }],
  ]);
  mockState.existing = [{ id: "existing-variant", optionValues: [
    { definitionId: "size-def", valueText: "38", valueNumber: null, valueBoolean: null },
    { definitionId: "color-def", valueText: "مشکی", valueNumber: null, valueBoolean: null },
  ] }];
  const input = variantGenerationSchema.parse({
    sizeDefinitionId: "size-def", sizeMode: "STANDARD", standardSizes: ["38"],
    colorDefinitionId: "color-def", colorValues: ["مشکی", "زیتونی", "کرم استخوانی", "آبی نفتی", " زیتونی "],
  });
  const result = await previewRetailVariantGeneration(context, "product-000001", input);
  assert.deepEqual(result.errors, []);
  assert.equal(result.existing, 1);
  assert.deepEqual(result.canCreate.map(item => item.options.find(o => o.definitionId === "color-def")?.value), ["زیتونی", "کرم استخوانی", "آبی نفتی"]);
  assert.equal(result.toAdd, 3);
});

test("preview still rejects disallowed values for unrelated non-color enum definitions", async () => {
  const { variantGenerationSchema, previewRetailVariantGeneration } = await import("@/lib/retail/merchant-catalog.server");
  mockState.productExists = true;
  mockState.definitions = new Map([
    ["color-def", { id: "color-def", key: "fabric", label: "جنس", scope: "VARIANT_OPTION", valueType: "ENUM", allowedValues: ["Cotton"] }],
  ]);
  mockState.existing = [];
  const input = variantGenerationSchema.parse({ colorDefinitionId: "color-def", colorValues: ["Linen"] });
  const result = await previewRetailVariantGeneration(context, "product-000001", input);
  assert.ok(result.errors.some(error => /allowed choices/.test(error)));
  assert.equal(result.toAdd, 0);
});

test("preview rejects generated combinations that exceed the 100-variant product cap", async () => {
  const { variantGenerationSchema, previewRetailVariantGeneration } = await import("@/lib/retail/merchant-catalog.server");
  mockState.productExists = true;
  mockState.definitions = new Map([
    ["size-def", { id: "size-def", key: "size", label: "Size", scope: "VARIANT_OPTION", valueType: "TEXT", allowedValues: null }],
    ["color-def", { id: "color-def", key: "color", label: "Color", scope: "VARIANT_OPTION", valueType: "TEXT", allowedValues: null }],
  ]);
  mockState.existing = [];
  const input = variantGenerationSchema.parse({ sizeDefinitionId: "size-def", sizeMode: "STANDARD", standardSizes: Array.from({ length: 10 }, (_, index) => `S${index}`), colorDefinitionId: "color-def", colorValues: Array.from({ length: 11 }, (_, index) => `C${index}`) });
  const result = await previewRetailVariantGeneration(context, "product-000001", input);
  assert.equal(result.toAdd, 110);
  assert.deepEqual(result.errors, ["A product can have at most 100 variants. Narrow the selected colors or sizes."]);
});
