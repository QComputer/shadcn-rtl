export interface CafeLeoBusinessInfo {
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  hours: string | null;
  socialLinks: string[];
  sourceProvided: Record<string, boolean>;
}

export interface CafeLeoProduct {
  sourceId: string;
  sourceHref: string;
  name: string;
  description: string | null;
  rawPrice: string;
  priceValue: number;
  currencyLabel: "تومان";
  imageUrl: string | null;
  imageCandidates: string[];
  tags: string[];
  availability: "available";
  order: number;
}

export interface CafeLeoCategory {
  sourceId: string;
  slug: string;
  name: string;
  order: number;
  products: CafeLeoProduct[];
}

export interface CafeLeoExtractionFixture {
  fixtureName: "cafe-leo-real-menu";
  frozenAt: string;
  source: {
    url: string;
    type: "next-static-html";
    authoritativeExtractionMethod: string;
    htmlTitle: string | null;
    imageSourceOrigin: string;
  };
  organization: {
    slug: "cafe-leo";
    domain: "leocafe.ir";
  };
  business: CafeLeoBusinessInfo;
  pricePolicy: {
    sourceRepresentation: string;
    interpretation: "literal-displayed-toman";
    bazarbaazStoredValue: "source numeric value without conversion";
    evidence: string[];
    guessed: false;
  };
  categories: CafeLeoCategory[];
  counts: {
    categories: number;
    products: number;
    pricedOrderable: number;
    unpriced: number;
    unavailable: number;
    uniqueProductImages: number;
    variantsDetected: number;
  };
  extractionEvidence: {
    categorySelector: string;
    productSelector: string;
    productIdSource: string;
    priceSelector: string;
    imageSelector: string;
    jsonLdPresent: boolean;
    apiCallsDetected: string[];
  };
}

export interface CafeLeoImportCounts {
  categories: number;
  products: number;
  activeProducts: number;
  inactiveProducts: number;
  variants: number;
  productsWithUsableVariant: number;
  productImages: number;
  imageRecords: number;
  duplicateCategorySlugs: number;
  duplicateProductSlugs: number;
  duplicateVariantSkus: number;
}

export interface CafeLeoImportResult {
  organizationSlug: string;
  created: {
    categories: number;
    products: number;
    variants: number;
    imageRecords: number;
  };
  updated: {
    organization: boolean;
    categories: number;
    products: number;
    variants: number;
  };
  deactivated: {
    products: number;
  };
  deleted: 0;
  counts: CafeLeoImportCounts;
}
