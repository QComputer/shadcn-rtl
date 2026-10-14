import { z } from "zod";

export const PUBLIC_CATALOG_VERSION = "v1" as const;
export const PUBLIC_CATALOG_PRICE_UNIT = "TOMAN" as const;
export const PUBLIC_CATALOG_DEFAULT_PAGE_SIZE = 20;
export const PUBLIC_CATALOG_MAX_PAGE_SIZE = 50;
export const publicCatalogAttributeFilterSchema = z.string().trim().min(3).max(200).regex(/^[a-zA-Z0-9._-]+:.+$/);

export const publicCatalogListQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(1_000_000).default(1),
  limit: z.coerce.number().int().positive().max(PUBLIC_CATALOG_MAX_PAGE_SIZE).default(PUBLIC_CATALOG_DEFAULT_PAGE_SIZE),
  category: z.string().trim().min(1).max(160).optional(),
  tag: z.string().trim().min(1).max(64).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  minPrice: z.coerce.number().finite().nonnegative().max(9_999_999_999.99).optional(),
  maxPrice: z.coerce.number().finite().nonnegative().max(9_999_999_999.99).optional(),
  sort: z.enum(["featured", "price-asc", "price-desc", "name-asc", "newest"]).default("featured"),
  filter: z.union([publicCatalogAttributeFilterSchema, z.array(publicCatalogAttributeFilterSchema).max(12)]).optional(),
}).strict().superRefine((query, context) => {
  if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) context.addIssue({ code: "custom", path: ["minPrice"], message: "Minimum price cannot be greater than maximum price." });
}).transform(({ filter, ...query }) => filter === undefined ? query : ({ ...query, filter: typeof filter === "string" ? [filter] : filter }));

export type PublicCatalogMoney = { amount: number; currency: typeof PUBLIC_CATALOG_PRICE_UNIT };
export type PublicCatalogMedia = { card: string | null; detail: string | null; alt: string; gallery: string[] };
export type PublicCatalogPurchase = { href: string; productId: string };
export type PublicCatalogVariant = {
  id: string;
  name: string | null;
  price: PublicCatalogMoney;
  listPrice: PublicCatalogMoney | null;
  orderable: boolean;
  sku: string | null;
  options: PublicCatalogAttribute[];
};
export type PublicCatalogAttribute = {
  key: string;
  label: string;
  valueType: "TEXT" | "NUMBER" | "BOOLEAN" | "ENUM";
  value: string | number | boolean;
  displayUnit: string | null;
  filterable: boolean;
};
export type PublicCatalogCategory = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  sortOrder: number;
  image: string | null;
  productCount: number;
};
export type PublicCatalogProduct = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  category: { id: string; slug: string | null; name: string };
  price: PublicCatalogMoney;
  listPrice: PublicCatalogMoney | null;
  media: PublicCatalogMedia;
  orderable: boolean;
  variants: PublicCatalogVariant[];
  attributes: PublicCatalogAttribute[];
  purchase: PublicCatalogPurchase | null;
};

const publicCatalogMoneySchema = z.object({ amount: z.number().finite().nonnegative(), currency: z.literal(PUBLIC_CATALOG_PRICE_UNIT) }).strict();
export const publicCatalogAttributeSchema = z.object({
  key: z.string().min(1), label: z.string().min(1), valueType: z.enum(["TEXT", "NUMBER", "BOOLEAN", "ENUM"]),
  value: z.union([z.string(), z.number().finite(), z.boolean()]), displayUnit: z.string().nullable(), filterable: z.boolean(),
}).strict();
export const publicCatalogProductSchema = z.object({
  id: z.string().min(1), slug: z.string().nullable(), name: z.string().min(1), description: z.string().nullable(),
  category: z.object({ id: z.string().min(1), slug: z.string().nullable(), name: z.string().min(1) }).strict(),
  price: publicCatalogMoneySchema, listPrice: publicCatalogMoneySchema.nullable(),
  media: z.object({ card: z.string().nullable(), detail: z.string().nullable(), alt: z.string(), gallery: z.array(z.string()) }).strict(),
  orderable: z.boolean(), attributes: z.array(publicCatalogAttributeSchema),
  variants: z.array(z.object({ id: z.string().min(1), name: z.string().nullable(), price: publicCatalogMoneySchema,
    listPrice: publicCatalogMoneySchema.nullable(), orderable: z.boolean(), sku: z.string().nullable(), options: z.array(publicCatalogAttributeSchema) }).strict()),
  purchase: z.object({ href: z.string(), productId: z.string() }).strict().nullable(),
}).strict();
export const publicCatalogCategorySchema = z.object({ id: z.string(), slug: z.string().nullable(), name: z.string(), description: z.string().nullable(), sortOrder: z.number().int(), image: z.string().nullable(), productCount: z.number().int().nonnegative() }).strict();
export const publicCatalogPaginationSchema = z.object({ page: z.number().int().positive(), limit: z.number().int().positive().max(PUBLIC_CATALOG_MAX_PAGE_SIZE), total: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative() }).strict();
export const publicCatalogProductsPageSchema = z.object({ products: z.array(publicCatalogProductSchema), pagination: publicCatalogPaginationSchema }).strict();
export const publicCatalogSnapshotSchema = z.object({
  organization: z.object({ identifier: z.string(), name: z.string(), description: z.string().nullable(), theme: z.enum(["FASHION", "ELECTRONICS", "GENERAL"]), previewOnly: z.boolean(), branding: z.object({ logo: z.string().nullable(), cover: z.string().nullable() }).strict() }).strict(),
  priceUnit: z.literal(PUBLIC_CATALOG_PRICE_UNIT), categories: z.array(publicCatalogCategorySchema), products: z.array(publicCatalogProductSchema), pagination: publicCatalogPaginationSchema,
}).strict();

export type PublicCatalogPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
export type PublicCatalogProductsPage = { products: PublicCatalogProduct[]; pagination: PublicCatalogPagination };
export type PublicCatalogSnapshot = {
  organization: { identifier: string; name: string; description: string | null; theme: "FASHION" | "ELECTRONICS" | "GENERAL"; previewOnly: boolean; branding: { logo: string | null; cover: string | null } };
  priceUnit: typeof PUBLIC_CATALOG_PRICE_UNIT;
  categories: PublicCatalogCategory[];
  products: PublicCatalogProduct[];
  pagination: PublicCatalogPagination;
};

export const PUBLIC_CATALOG_PRIVATE_FIELD_DENYLIST = [
  "organizationId", "organizationSlug", "deletedAt", "inventory", "reservedQuantity",
  "allowBackOrder", "trackInventory", "lowStockThreshold", "costPrice", "settings",
  "integrations", "members", "orders", "customers", "imei", "serialNumber", "deviceIdentifier",
] as const;
