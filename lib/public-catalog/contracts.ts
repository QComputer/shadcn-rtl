import { z } from "zod";

export const PUBLIC_CATALOG_VERSION = "v1" as const;
export const PUBLIC_CATALOG_PRICE_UNIT = "TOMAN" as const;
export const PUBLIC_CATALOG_DEFAULT_PAGE_SIZE = 20;
export const PUBLIC_CATALOG_MAX_PAGE_SIZE = 50;

export const publicCatalogListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(PUBLIC_CATALOG_MAX_PAGE_SIZE).default(PUBLIC_CATALOG_DEFAULT_PAGE_SIZE),
  category: z.string().trim().min(1).max(160).optional(),
  q: z.string().trim().min(1).max(100).optional(),
}).strict();

export type PublicCatalogMoney = { amount: number; currency: typeof PUBLIC_CATALOG_PRICE_UNIT };
export type PublicCatalogMedia = { card: string | null; detail: string | null; alt: string };
export type PublicCatalogVariant = {
  id: string;
  name: string | null;
  price: PublicCatalogMoney;
  listPrice: PublicCatalogMoney | null;
  orderable: boolean;
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
};

export type PublicCatalogPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export const PUBLIC_CATALOG_PRIVATE_FIELD_DENYLIST = [
  "organizationId", "organizationSlug", "deletedAt", "inventory", "reservedQuantity",
  "allowBackOrder", "trackInventory", "lowStockThreshold", "costPrice", "settings",
  "integrations", "members", "orders", "customers",
] as const;
