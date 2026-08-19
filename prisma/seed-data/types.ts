export interface SourceBlock {
  id: number;
  sort: number;
  reason: string;
}

export interface CategoryMappingEntry {
  blockId: number;
  blockSort: number;
  slug: string;
  sourceLabel: string | null;
  displayLabelFa: string;
  sourceImageUrl: string;
  sourceOcrText: string | null;
  itemCount: number;
  priced: number;
  unpriced: number;
  inferenceStatus?: string;
  inferenceBasis?: string;
  fullyEmpty?: number;
  seedDecision?: string;
}

export interface ExtractionItem {
  itemId: number;
  itemOrder: number;
  blockId: number;
  blockSort: number;
  sourceLabel: string | null;
  displayLabelFa: string;
  slug: string;
  sourceName: string;
  description: string | null;
  rawPrice: string | null;
  normalizedPrice: string | null;
  availability: "available" | "hidden";
  imageUrl: string;
  sourceVisible: boolean;
  extractionEvidence: string;
}

export interface FullyEmptyItem {
  blockId: number;
  blockSort: number;
  itemOrder: number;
  itemId: number;
  sourceName: string;
  description: string | null;
  rawPrice: string | null;
  normalizedPrice: string | null;
  seedDecision: string;
}

export interface UnpricedItem {
  blockId: number;
  blockSort: number;
  itemOrder: number;
  itemId: number;
  sourceName: string;
  description: string | null;
  rawPrice: string | null;
  normalizedPrice: string | null;
  seedDecision: string;
}

export interface ExtractionFixture {
  fixtureName: string;
  frozenAt: string;
  source: {
    type: string;
    apiEndpoint: string;
    link: string;
    profileId: number;
    totalBlocks: number;
    ignoredBlocks: SourceBlock[];
    menuCategoryBlocks: number;
    blocksWithItems: number;
    placeholderBlocks: number;
    emptyBlocks: number;
  };
  organization: {
    slug: string;
    domain: string;
    displayName: string;
  };
  pricePolicy: {
    source: string;
    interpretation: string;
    example: string;
    proof: string;
    bazarbazStorage: string;
    bazarbazDisplay: string;
    bazarbazInterpretation: boolean;
    note: string;
  };
  categoryMapping: Record<string, CategoryMappingEntry>;
  items: ExtractionItem[];
  fullyEmptyItems: FullyEmptyItem[];
  unpricedItemsSummary: {
    totalUnpricedWithTitle: number;
    items: UnpricedItem[];
  };
  counts: {
    totalMenuRows: number;
    titledRows: number;
    pricedItems: number;
    titledUnpricedItems: number;
    fullyEmptyItems: number;
    activeMenuCategoryBlocks: number;
    placeholderBlocks: number;
    ignoredBlocks: number;
    totalBlocks: number;
  };
  extractionEvidence: {
    sourceFiles: string[];
    domProof: string;
    blockLevelImageFields: string;
    itemLevelImageFields: string;
  };
}

export interface CategoryValidationResult {
  blockId: number;
  displayLabelFa: string;
  isValid: boolean;
  errors: string[];
}

export interface ItemValidationResult {
  itemId: number;
  blockId: number;
  title: string;
  isValid: boolean;
  errors: string[];
}
