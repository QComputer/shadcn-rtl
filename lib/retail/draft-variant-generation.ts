export type DraftVariantDefinition = { id: string; allowedValues?: unknown; valueType?: string };

export type NewRetailVariantDraft = {
  galleryMode: "INHERIT";
  name: string;
  sku: string;
  price: string;
  inventory: string;
  reservedQuantity: 0;
  allowBackOrder: boolean;
  manuallyUnavailable: false;
  options: Record<string, string>;
  imageIds: [];
};

export type DraftVariantGenerationInput = {
  colorDefinition: DraftVariantDefinition;
  sizeDefinition: DraftVariantDefinition;
  colors: string[];
  sizes: string[];
  existing: Array<{ options: Record<string, string> }>;
  skuPrefix: string;
  price: string;
  inventory: string;
  allowBackOrder: boolean;
};

const MAX_VARIANTS = 100;
const MAX_INVENTORY = 1_000_000_000;

function requiredValues(values: string[], label: string) {
  const unique = [...new Set(values)];
  if (!unique.length || unique.some(value => typeof value !== "string" || !value.trim())) {
    throw new TypeError(`${label} must contain non-empty values`);
  }
  return unique;
}

function validateAllowed(values: string[], definition: DraftVariantDefinition, label: string) {
  if (definition.valueType !== "ENUM" && definition.allowedValues === undefined) return;
  if (!Array.isArray(definition.allowedValues) || definition.allowedValues.length === 0) return;
  const allowed = new Set(definition.allowedValues.filter((value): value is string => typeof value === "string"));
  const invalid = values.find(value => !allowed.has(value));
  if (invalid !== undefined) throw new RangeError(`${label} contains a value outside the allowed choices`);
}

function validateInventory(value: string) {
  if (!/^\d+$/.test(value)) throw new RangeError("Inventory must be a whole number from 0 to 1000000000");
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount > MAX_INVENTORY) throw new RangeError("Inventory must be a whole number from 0 to 1000000000");
}

function validatePrice(value: string) {
  if (value === "") return;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError("Price must be blank or greater than zero");
}

function skuPart(value: string) {
  return value.trim().toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "value";
}

function optionValue(options: Record<string, string>, id: string) { return options[id] ?? ""; }

export function buildNewRetailVariantDrafts(input: DraftVariantGenerationInput): NewRetailVariantDraft[] {
  const colors = requiredValues(input.colors, "Colors");
  const sizes = requiredValues(input.sizes, "Sizes");
  validateAllowed(colors, input.colorDefinition, "Colors");
  validateAllowed(sizes, input.sizeDefinition, "Sizes");
  validateInventory(input.inventory);
  validatePrice(input.price);

  const existingCombinations = new Set(input.existing.map(({ options }) => JSON.stringify([
    optionValue(options, input.colorDefinition.id), optionValue(options, input.sizeDefinition.id),
  ])));
  const planned = colors.flatMap(color => sizes
    .filter(size => !existingCombinations.has(JSON.stringify([color, size])))
    .map(size => ({ color, size })));
  if (input.existing.length + planned.length > MAX_VARIANTS) throw new RangeError("A product cannot have more than 100 variants");

  const skuRoot = input.skuPrefix.trim() || "variant";
  const usedSkus = new Set<string>();
  return planned.map(({ color, size }) => {
    const suffix = `${skuPart(color)}-${skuPart(size)}`;
    const base = `${skuRoot}-${suffix}`.slice(0, 90);
    let sku = base, sequence = 2;
    while (usedSkus.has(sku.toLocaleLowerCase("en"))) sku = `${base}-${sequence++}`;
    usedSkus.add(sku.toLocaleLowerCase("en"));
    return {
      galleryMode: "INHERIT",
      name: `${color} / ${size}`,
      sku,
      price: input.price,
      inventory: input.inventory,
      reservedQuantity: 0,
      allowBackOrder: input.allowBackOrder,
      manuallyUnavailable: false,
      options: { [input.colorDefinition.id]: color, [input.sizeDefinition.id]: size },
      imageIds: [],
    };
  });
}

export type RetailSizeRangeInput = { start: number; end: number; step: 0.5 | 1 | 2 | 3 };

/** Returns canonical raw numeric strings; display localization belongs to the view. */
export function generateRetailSizeRange({ start, end, step }: RetailSizeRangeInput): string[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start * 2 !== Math.round(start * 2) || end * 2 !== Math.round(end * 2)) {
    throw new RangeError("Size endpoints must be finite half-step values");
  }
  if (![0.5, 1, 2, 3].includes(step) || start > end || start < 1 || end > 999) throw new RangeError("Size range or step is invalid");
  const intervals = (end - start) / step;
  if (!Number.isInteger(intervals)) throw new RangeError("Size range must end on a step boundary");
  const count = intervals + 1;
  if (count > MAX_VARIANTS) throw new RangeError("A size range cannot create more than 100 values");
  return Array.from({ length: count }, (_, index) => String(Number((start + index * step).toFixed(1))));
}
