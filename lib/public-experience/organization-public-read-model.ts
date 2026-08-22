import type { BusinessEntityStatus, InternalBusinessEntityType, OrganizationCapabilityKey, OrganizationType } from "@prisma/client";
import { effectiveOrganizationCapabilities } from "@/lib/organization-capabilities";

type CapabilityRecord = {
  key: OrganizationCapabilityKey;
  status: "ACTIVE" | "INACTIVE";
};

type PublicProduct = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  price: number;
  category: { id: string; name: string; slug: string | null } | null;
};

type PublicService = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  price: number;
  duration: number;
  category: { id: string; name: string; slug: string | null } | null;
};

type PublicCategory = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  kind: "PRODUCT" | "SERVICE";
};

type PublicBusinessHour = {
  day: string;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
};

type PublicBusinessEntity = {
  id: string;
  type: InternalBusinessEntityType;
  title: string;
  slug: string | null;
  status: BusinessEntityStatus;
  schemaTypes: string[];
  seoTitle: string | null;
  seoDescription: string | null;
};

type PublicSeoSummary = {
  openOpportunityCount: number;
  opportunityTypes: string[];
  schemaTypes: string[];
  approvedContentAssets: Array<{
    id: string;
    title: string;
    contentType: string;
    schemaType: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
  }>;
};

type PublicReputationSummary = {
  score: number;
  averageRating: number;
  reviewCount: number;
  verifiedReviewCount: number;
  verifiedReviewRatio: number;
  responseRate: number;
  recentActivity: number;
  selectedReviews: Array<{
    id: string;
    rating: number;
    title: string | null;
    text: string | null;
    verifiedInteraction: boolean;
    customerLabel: string;
    businessResponse: { text: string; respondedAt: string | null } | null;
    createdAt: string;
  }>;
  schemaReadiness: {
    LocalBusiness: true;
    AggregateRating: boolean;
    Review: boolean;
    publicSchemaInjected: false;
  };
};

export type PublicOrganizationSource = {
  id: string;
  type: OrganizationType;
  capabilitiesInitializedAt?: Date | string | null;
  capabilities?: CapabilityRecord[] | null;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  coverImage: string | null;
  locale: string;
  timezone: string;
  isOpen: boolean;
  settings?: { settings: unknown } | null;
  productCategories?: Array<Omit<PublicCategory, "kind">>;
  serviceCategories?: Array<Omit<PublicCategory, "kind">>;
  products?: Array<PublicProduct>;
  services?: Array<PublicService>;
  businessHours?: PublicBusinessHour[];
  businessEntities?: Array<PublicBusinessEntity>;
  seoOpportunities?: Array<{ opportunityType: string; status: string }>;
  contentAssets?: PublicSeoSummary["approvedContentAssets"];
  reputation?: PublicReputationSummary;
};

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function publicSocialLinks(settings: unknown) {
  const root = objectRecord(settings);
  const social = objectRecord(root.socialLinks);
  return Object.fromEntries(
    Object.entries(social).filter(([, value]) => typeof value === "string" && value.length > 0),
  );
}

export function buildPublicOrganizationReadModel(organization: PublicOrganizationSource) {
  const capabilities = effectiveOrganizationCapabilities({
    legacyType: organization.type,
    capabilitiesInitializedAt: organization.capabilitiesInitializedAt,
    capabilities: organization.capabilities,
  });
  const productCategories = organization.productCategories ?? [];
  const serviceCategories = organization.serviceCategories ?? [];
  const products = organization.products ?? [];
  const services = organization.services ?? [];
  const businessEntities = organization.businessEntities ?? [];
  const openOpportunities = (organization.seoOpportunities ?? []).filter((opportunity) => opportunity.status === "OPEN");
  const schemaTypes = Array.from(new Set([
    ...businessEntities.flatMap((entity) => entity.schemaTypes),
    ...(organization.contentAssets ?? []).map((asset) => asset.schemaType).filter((schemaType): schemaType is string => Boolean(schemaType)),
  ]));

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      locale: organization.locale,
      timezone: organization.timezone,
      logo: organization.logo,
      coverImage: organization.coverImage,
      isOpen: organization.isOpen,
      capabilities,
      contact: {
        address: organization.address,
        phone: organization.phone,
        email: organization.email,
        location: organization.lat !== null && organization.lng !== null
          ? { lat: organization.lat, lng: organization.lng }
          : null,
      },
      socialLinks: publicSocialLinks(organization.settings?.settings),
    },
    catalog: {
      categories: [
        ...productCategories.map((category) => ({ ...category, kind: "PRODUCT" as const })),
        ...serviceCategories.map((category) => ({ ...category, kind: "SERVICE" as const })),
      ],
      products,
      services,
    },
    businessHours: organization.businessHours ?? [],
    seo: {
      openOpportunityCount: openOpportunities.length,
      opportunityTypes: Array.from(new Set(openOpportunities.map((opportunity) => opportunity.opportunityType))),
      schemaTypes,
      approvedContentAssets: organization.contentAssets ?? [],
    } satisfies PublicSeoSummary,
    reputation: organization.reputation ?? {
      score: 0,
      averageRating: 0,
      reviewCount: 0,
      verifiedReviewCount: 0,
      verifiedReviewRatio: 0,
      responseRate: 0,
      recentActivity: 0,
      selectedReviews: [],
      schemaReadiness: {
        LocalBusiness: true,
        AggregateRating: false,
        Review: false,
        publicSchemaInjected: false,
      },
    },
    businessEntities,
  };
}
