import "server-only";

import type { ExternalCatalogChangeType, ExternalCatalogItemType, ExternalCatalogProvider } from "@prisma/client";

export type ExternalCatalogRawItem = {
  externalId: string;
  externalType: ExternalCatalogItemType;
  rawName: string;
  price?: number;
  duration?: number;
  imageUrl?: string;
  parentExternalId?: string;
};

export type ExternalCatalogPreview = {
  provider: ExternalCatalogProvider;
  sourceLabel: string;
  categories: number;
  products: number;
  images: number;
  items: ExternalCatalogRawItem[];
};

export type ExternalCatalogComparison = {
  externalId: string;
  externalType: ExternalCatalogItemType;
  rawName: string;
  changeType: ExternalCatalogChangeType;
  currentValue?: Record<string, unknown> | null;
  incomingValue: Record<string, unknown>;
};

export interface ExternalCatalogConnector {
  provider: ExternalCatalogProvider;
  validateConnection(input: { externalUrl?: string | null }): Promise<{ valid: true; provider: ExternalCatalogProvider }>;
  discoverCatalog(input: { externalUrl?: string | null }): Promise<ExternalCatalogPreview>;
  fetchCatalog(input: { externalUrl?: string | null }): Promise<ExternalCatalogPreview>;
  normalizeCatalog(input: ExternalCatalogPreview): ExternalCatalogPreview;
  previewCatalog(input: { externalUrl?: string | null }): Promise<ExternalCatalogPreview>;
  previewImport(input: { externalUrl?: string | null }): Promise<ExternalCatalogPreview>;
  compareChanges(input: {
    externalUrl?: string | null;
    currentItems: Array<{ externalId?: string | null; name: string; price?: number | null }>;
  }): Promise<ExternalCatalogComparison[]>;
  importApprovedItems(): Promise<never>;
}

const SAMPLE_RESTAURANT_ITEMS: ExternalCatalogRawItem[] = [
  { externalId: "cat-pizza", externalType: "CATEGORY", rawName: "پیتزا" },
  { externalId: "cat-burger", externalType: "CATEGORY", rawName: "برگر" },
  { externalId: "cat-drink", externalType: "CATEGORY", rawName: "نوشیدنی" },
  { externalId: "product-pepperoni", externalType: "PRODUCT", rawName: "پیتزا پپرونی", price: 290000, parentExternalId: "cat-pizza" },
  { externalId: "product-margherita", externalType: "PRODUCT", rawName: "پیتزا مارگاریتا", price: 250000, parentExternalId: "cat-pizza" },
  { externalId: "product-cheese-burger", externalType: "PRODUCT", rawName: "چیزبرگر", price: 210000, parentExternalId: "cat-burger" },
  { externalId: "product-cola", externalType: "PRODUCT", rawName: "نوشابه", price: 35000, parentExternalId: "cat-drink" },
  { externalId: "image-pepperoni", externalType: "IMAGE", rawName: "تصویر پیتزا پپرونی", parentExternalId: "product-pepperoni" },
];

class MockCatalogConnector implements ExternalCatalogConnector {
  constructor(public provider: ExternalCatalogProvider) {}

  async validateConnection(input: { externalUrl?: string | null }) {
    if (input.externalUrl && !/^https?:\/\//i.test(input.externalUrl)) {
      throw new Error("External catalog URL must be HTTP(S)");
    }
    return { valid: true as const, provider: this.provider };
  }

  async discoverCatalog(input: { externalUrl?: string | null }) {
    return this.previewCatalog(input);
  }

  async fetchCatalog(input: { externalUrl?: string | null }) {
    return {
      provider: this.provider,
      sourceLabel: input.externalUrl || `${this.provider} demo source`,
      categories: SAMPLE_RESTAURANT_ITEMS.filter((item) => item.externalType === "CATEGORY").length,
      products: SAMPLE_RESTAURANT_ITEMS.filter((item) => item.externalType === "PRODUCT").length,
      images: SAMPLE_RESTAURANT_ITEMS.filter((item) => item.externalType === "IMAGE").length,
      items: SAMPLE_RESTAURANT_ITEMS,
    };
  }

  normalizeCatalog(input: ExternalCatalogPreview) {
    return {
      ...input,
      items: input.items.map((item) => ({
        ...item,
        rawName: item.rawName.trim(),
      })),
    };
  }

  async previewImport(input: { externalUrl?: string | null }) {
    return this.previewCatalog(input);
  }

  async previewCatalog(input: { externalUrl?: string | null }) {
    await this.validateConnection(input);
    return this.normalizeCatalog(await this.fetchCatalog(input));
  }

  async compareChanges(input: {
    externalUrl?: string | null;
    currentItems: Array<{ externalId?: string | null; name: string; price?: number | null }>;
  }) {
    const preview = await this.previewCatalog({ externalUrl: input.externalUrl });
    return preview.items
      .filter((item) => item.externalType === "CATEGORY" || item.externalType === "PRODUCT" || item.externalType === "SERVICE")
      .map((item) => {
        const current = input.currentItems.find((candidate) =>
          candidate.externalId === item.externalId ||
          candidate.name.trim().toLocaleLowerCase("fa-IR") === item.rawName.trim().toLocaleLowerCase("fa-IR"),
        );
        const incomingValue = { name: item.rawName, price: item.price ?? null };
        if (!current) {
          return {
            externalId: item.externalId,
            externalType: item.externalType,
            rawName: item.rawName,
            changeType: "NEW_ITEM" as const,
            currentValue: null,
            incomingValue,
          };
        }
        if (item.price !== undefined && current.price !== null && current.price !== undefined && Number(current.price) !== item.price) {
          return {
            externalId: item.externalId,
            externalType: item.externalType,
            rawName: item.rawName,
            changeType: "PRICE_CHANGED" as const,
            currentValue: { name: current.name, price: current.price },
            incomingValue,
          };
        }
        if (current.name.trim() !== item.rawName.trim()) {
          return {
            externalId: item.externalId,
            externalType: item.externalType,
            rawName: item.rawName,
            changeType: "NAME_CHANGED" as const,
            currentValue: { name: current.name, price: current.price ?? null },
            incomingValue,
          };
        }
        return {
          externalId: item.externalId,
          externalType: item.externalType,
          rawName: item.rawName,
          changeType: "UNCHANGED" as const,
          currentValue: { name: current.name, price: current.price ?? null },
          incomingValue,
        };
      });
  }

  async importApprovedItems(): Promise<never> {
    throw new Error("Provider-side import is intentionally disabled; Bazarbaaz imports from approved preview items only");
  }
}

export function getExternalCatalogConnector(provider: ExternalCatalogProvider): ExternalCatalogConnector {
  return new MockCatalogConnector(provider);
}

export function listExternalCatalogProviders(): ExternalCatalogProvider[] {
  return ["SNAPPFOOD", "EZY", "MANUAL_IMPORT", "FUTURE_PROVIDER"];
}
