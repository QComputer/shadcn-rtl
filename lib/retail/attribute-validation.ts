import { z } from "zod";

export const retailAttributeDefinitionInputSchema = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  label: z.string().trim().min(1).max(120),
  localizedLabels: z.record(z.string(), z.string().trim().min(1).max(120)).default({}),
  scope: z.enum(["PRODUCT", "VARIANT_OPTION"]),
  valueType: z.enum(["TEXT", "NUMBER", "BOOLEAN", "ENUM"]),
  displayUnit: z.string().trim().max(24).nullable().default(null),
  localizedUnits: z.record(z.string(), z.string().trim().max(24)).default({}),
  allowedValues: z.array(z.string().trim().min(1).max(120)).max(200).nullable().default(null),
  isFilterable: z.boolean().default(false),
}).strict().superRefine((definition, context) => {
  if (definition.valueType === "ENUM" && !definition.allowedValues?.length) context.addIssue({ code: "custom", path: ["allowedValues"], message: "Enum attributes require at least one allowed value." });
  if (definition.valueType !== "ENUM" && definition.allowedValues?.length) context.addIssue({ code: "custom", path: ["allowedValues"], message: "Allowed values are only supported for enum attributes." });
});

export type RetailAttributeDefinitionInput = z.output<typeof retailAttributeDefinitionInputSchema>;
export type ValidatedRetailAttributeValue = { valueText: string | null; valueNumber: number | null; valueBoolean: boolean | null };

export function validateRetailAttributeValue(definition: Pick<RetailAttributeDefinitionInput, "valueType" | "allowedValues">, value: unknown): ValidatedRetailAttributeValue {
  if (definition.valueType === "NUMBER") {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Numeric attribute values must be finite numbers.");
    return { valueText: null, valueNumber: value, valueBoolean: null };
  }
  if (definition.valueType === "BOOLEAN") {
    if (typeof value !== "boolean") throw new Error("Boolean attribute values must be true or false.");
    return { valueText: null, valueNumber: null, valueBoolean: value };
  }
  if (typeof value !== "string" || !value.trim()) throw new Error("Text attribute values must be non-empty strings.");
  const normalized = value.trim();
  if (definition.valueType === "ENUM" && !definition.allowedValues?.includes(normalized)) throw new Error("Enum value is not in the tenant's configured allowed values.");
  return { valueText: normalized, valueNumber: null, valueBoolean: null };
}
