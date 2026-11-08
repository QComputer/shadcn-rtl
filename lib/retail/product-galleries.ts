import { z } from "zod";

const galleryIdSchema = z.string().min(1).max(64);

const uniqueImageIdsSchema = z
  .array(galleryIdSchema)
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length, "Image IDs must be unique");

const galleryColorInputSchema = z
  .object({
    definitionId: galleryIdSchema,
    value: z.string().min(1).max(1000),
    imageIds: uniqueImageIdsSchema,
  })
  .strict();

const appearanceImagePairSchema = z.object({
  lightImageId: galleryIdSchema.nullable().optional(),
  darkImageId: galleryIdSchema.nullable().optional(),
}).strict();
const appearanceGroupSchema = appearanceImagePairSchema.extend({
  definitionId: galleryIdSchema,
  value: z.string().min(1).max(1000),
}).strict();
const variantAppearanceSchema = appearanceImagePairSchema.extend({ variantId: galleryIdSchema }).strict();

export const gallerySettingsInputSchema = z
  .object({
    version: z.literal(1),
    productImageIds: uniqueImageIdsSchema,
    colors: z.array(galleryColorInputSchema).max(100),
    appearance: appearanceImagePairSchema.optional(),
    appearanceGroups: z.array(appearanceGroupSchema).max(100).optional(),
    variantAppearances: z.array(variantAppearanceSchema).max(100).optional(),
  })
  .strict()
  .superRefine((settings, context) => {
    const seenGroups = new Set<string>();
    settings.colors.forEach((color, index) => {
      const key = colorGroupKey(color.definitionId, color.value);
      if (seenGroups.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["colors", index],
          message: "Each color option group can be configured only once.",
        });
      }
      seenGroups.add(key);
    });
    const groupKeys = new Set<string>();
    settings.appearanceGroups?.forEach((group, index) => {
      const key = colorGroupKey(group.definitionId, group.value);
      if (groupKeys.has(key)) context.addIssue({ code: "custom", path: ["appearanceGroups", index], message: "Each appearance option group can be configured only once." });
      groupKeys.add(key);
    });
    const variantIds = new Set<string>();
    settings.variantAppearances?.forEach((appearance, index) => {
      if (variantIds.has(appearance.variantId)) context.addIssue({ code: "custom", path: ["variantAppearances", index], message: "Each variant appearance can be configured only once." });
      variantIds.add(appearance.variantId);
    });
  });

const storedGallerySettingsSchema = gallerySettingsInputSchema
  .safeExtend({
    overrides: z
      .array(galleryIdSchema)
      .max(100)
      .refine((ids) => new Set(ids).size === ids.length, "Override IDs must be unique")
      .optional(),
  });

export type GallerySettingsInput = z.infer<typeof gallerySettingsInputSchema>;

export type AppearanceImagePair = z.infer<typeof appearanceImagePairSchema>;

export type GallerySettings = GallerySettingsInput & {
  overrides: string[];
};

/** Read persisted settings without letting malformed or future data break rendering. */
export function readGallerySettings(value: unknown): GallerySettings | null {
  const parsed = storedGallerySettingsSchema.safeParse(value);
  if (!parsed.success) return null;

  return {
    ...parsed.data,
    overrides: parsed.data.overrides ?? [],
  };
}

/** Apply a saved image order while retaining images absent from older metadata. */
export function orderedImages<T extends { id: string }>(images: T[], ids: string[]): T[] {
  const byId = new Map(images.map((image) => [image.id, image]));
  const ordered: T[] = [];
  const included = new Set<string>();

  for (const id of ids) {
    const image = byId.get(id);
    if (image && !included.has(id)) {
      ordered.push(image);
      included.add(id);
    }
  }

  for (const image of images) {
    if (!included.has(image.id)) {
      ordered.push(image);
      included.add(image.id);
    }
  }

  return ordered;
}

/** Encode a color option pair without ambiguous delimiter collisions. */
export function colorGroupKey(definitionId: string, value: string): string {
  return JSON.stringify([definitionId, value]);
}

/** Detect size semantics from tenant-defined option keys and labels. */
export function isRetailSizeDefinition(key: string, label: string): boolean {
  const normalized = `${key} ${label}`.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase().replace(/[_-]+/g, " ");
  return /(?:^|\s)size(?:$|\s)|سایز|اندازه|مقاس/.test(normalized);
}

export type RetailColorDefinitionLike = {
  key?: string | null;
  label?: string | null;
  scope?: string | null;
  valueType?: string | null;
};

const RETAIL_COLOR_PATTERN = /colou?r|رنگ|لون/i;

/** Recognized VARIANT_OPTION color definitions accept merchant-entered freeform values. */
export function isRetailColorDefinition(definition: RetailColorDefinitionLike): boolean {
  if (definition.scope && definition.scope !== "VARIANT_OPTION") return false;
  return RETAIL_COLOR_PATTERN.test(`${definition.key ?? ""} ${definition.label ?? ""}`);
}

export function allowsRetailFreeformColor(definition: RetailColorDefinitionLike): boolean {
  return definition.valueType === "ENUM" && isRetailColorDefinition(definition);
}

export const MAX_RETAIL_COLOR_NAME_LENGTH = 120;

/** Infer a shared product gallery and preserve every differing variant as an override. */
export function inferColorGallery(
  variants: { id?: string; imageIds: string[] }[],
): { imageIds: string[]; overrideIds: string[] } {
  const counts = new Map<string, { imageIds: string[]; count: number }>();

  variants.forEach((variant) => {
    const key = JSON.stringify(variant.imageIds);
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { imageIds: [...variant.imageIds], count: 1 });
  });

  let selected: { imageIds: string[]; count: number } | undefined;
  for (const candidate of counts.values()) {
    if (!selected || candidate.count > selected.count) selected = candidate;
  }

  const imageIds = selected?.imageIds ?? [];
  const commonKey = JSON.stringify(imageIds);
  return {
    imageIds,
    overrideIds: variants
      .filter((variant) => JSON.stringify(variant.imageIds) !== commonKey)
      .flatMap((variant) => (variant.id === undefined ? [] : [variant.id])),
  };
}
