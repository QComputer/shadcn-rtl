import type { OrganizationCapabilityKey, OrganizationIndustryKey, OrganizationType } from "@prisma/client";
import { organizationCapabilityKeys } from "@/lib/validators/tenant-platform";
import { legacyTypeForCapabilities } from "@/lib/organization-capabilities";

export type AcquisitionProductCapability =
  | OrganizationCapabilityKey
  | "SEO"
  | "CAMPAIGN"
  | "CUSTOMER_ENGAGEMENT"
  | "CONTENT";

export type SuggestedIntegrationKey = "iMenu" | "iAM" | "iCV" | "EBC" | "USSD";

export type GrowthIntelligenceMetadata = {
  recommendedInotiServices: SuggestedIntegrationKey[];
  seoOpportunities: Array<{
    key: string;
    title: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH";
  }>;
  iamPageBlueprintHints: string[];
  customerJourneySuggestions: string[];
  activationChecklist: string[];
};

export type IndustryTemplate = {
  industryKey: OrganizationIndustryKey;
  displayName: string;
  description: string;
  recommendedCapabilities: AcquisitionProductCapability[];
  onboardingChecklist: string[];
  suggestedIntegrations: SuggestedIntegrationKey[];
  growthIntelligence: GrowthIntelligenceMetadata;
};

const PLATFORM_CAPABILITIES = new Set<string>(organizationCapabilityKeys);

export const INDUSTRY_TEMPLATES = [
  {
    industryKey: "RESTAURANT",
    displayName: "Restaurant",
    description: "Menu, ordering, preparation workflow, customer retention, and local SEO readiness.",
    recommendedCapabilities: ["SHOP", "CRM", "CAMPAIGN", "SEO", "CUSTOMER_ENGAGEMENT"],
    onboardingChecklist: ["Create public restaurant page", "Add menu categories", "Enable CRM", "Review SEO opportunities", "Prepare engagement dry-run"],
    suggestedIntegrations: ["iMenu", "USSD"],
    growthIntelligence: {
      recommendedInotiServices: ["iMenu", "USSD"],
      seoOpportunities: [
        { key: "restaurant-menu-local-page", title: "Local menu landing page", description: "Prepare SEO copy for menu discovery and local intent.", priority: "HIGH" },
        { key: "restaurant-delivery-faq", title: "Delivery and ordering FAQ", description: "Prepare FAQ content for ordering, pickup, delivery, and preparation timing.", priority: "MEDIUM" },
      ],
      iamPageBlueprintHints: ["menu categories", "popular dishes", "delivery zones", "opening hours"],
      customerJourneySuggestions: ["Discover menu", "Place order", "Track preparation", "Return through retention campaign"],
      activationChecklist: ["Publish public restaurant shell", "Add menu categories", "Prepare SEO content brief", "Configure CRM segments", "Prepare USSD ordering readiness"],
    },
  },
  {
    industryKey: "PHARMACY",
    displayName: "Pharmacy",
    description: "Product discovery, customer profile, CRM follow-up, SEO, and engagement readiness.",
    recommendedCapabilities: ["SHOP", "CRM", "SEO", "CUSTOMER_ENGAGEMENT"],
    onboardingChecklist: ["Create public pharmacy page", "Add product categories", "Enable CRM", "Review SEO opportunities", "Prepare engagement dry-run"],
    suggestedIntegrations: ["USSD"],
    growthIntelligence: {
      recommendedInotiServices: ["USSD"],
      seoOpportunities: [
        { key: "pharmacy-product-discovery", title: "Product discovery SEO", description: "Prepare category and product discovery opportunities without medical claims.", priority: "HIGH" },
        { key: "pharmacy-customer-care-faq", title: "Customer care FAQ", description: "Prepare factual FAQ content for hours, availability, and customer service.", priority: "MEDIUM" },
      ],
      iamPageBlueprintHints: ["product categories", "public profile", "contact channels", "service area"],
      customerJourneySuggestions: ["Discover product", "Ask availability", "Save customer profile", "Receive engagement follow-up"],
      activationChecklist: ["Publish public pharmacy shell", "Add product categories", "Enable CRM profile capture", "Prepare compliant SEO brief", "Prepare USSD reach readiness"],
    },
  },
  {
    industryKey: "DENTAL_CLINIC",
    displayName: "Dental Clinic",
    description: "Service discovery, appointment booking, calendar operations, customer history, and SEO readiness.",
    recommendedCapabilities: ["APPOINTMENT", "CRM", "SEO"],
    onboardingChecklist: ["Create public clinic page", "Add service categories", "Configure appointment booking", "Enable CRM", "Review SEO opportunities"],
    suggestedIntegrations: ["iAM"],
    growthIntelligence: {
      recommendedInotiServices: ["iAM"],
      seoOpportunities: [
        { key: "dental-service-local-page", title: "Dental service landing page", description: "Prepare appointment-oriented service page recommendations.", priority: "HIGH" },
        { key: "dental-booking-faq", title: "Appointment booking FAQ", description: "Prepare FAQ content for booking, rescheduling, and visit preparation.", priority: "MEDIUM" },
      ],
      iamPageBlueprintHints: ["services", "staff", "booking flow", "clinic location"],
      customerJourneySuggestions: ["Discover service", "Book appointment", "Review calendar", "Continue with customer history"],
      activationChecklist: ["Publish clinic profile", "Add service categories", "Configure booking settings", "Prepare service SEO brief", "Prepare iAM page readiness"],
    },
  },
  {
    industryKey: "FASHION_BOUTIQUE",
    displayName: "Fashion Boutique",
    description: "Catalog discovery, customer preferences, CRM, content workflow, and personalized retail operations.",
    recommendedCapabilities: ["SHOP", "CRM", "CONTENT"],
    onboardingChecklist: ["Create public boutique page", "Add collections", "Enable CRM", "Prepare content workflow", "Review customer preference fields"],
    suggestedIntegrations: ["iCV", "EBC"],
    growthIntelligence: {
      recommendedInotiServices: ["iCV", "EBC"],
      seoOpportunities: [
        { key: "fashion-collection-content", title: "Collection content workflow", description: "Prepare content recommendations for collections and seasonal discovery.", priority: "HIGH" },
        { key: "fashion-preference-profile", title: "Preference profile readiness", description: "Prepare customer preference fields for manual recommendation demos.", priority: "MEDIUM" },
      ],
      iamPageBlueprintHints: ["collections", "size guidance", "style preferences", "seasonal content"],
      customerJourneySuggestions: ["Browse collection", "Share preferences", "Save size information", "Receive manual recommendation"],
      activationChecklist: ["Publish boutique shell", "Add collections", "Enable CRM preference fields", "Prepare content workflow", "Prepare EBC engagement readiness"],
    },
  },
  {
    industryKey: "RETAIL_SHOP",
    displayName: "Retail Shop",
    description: "Catalog, order handling, CRM, and practical growth readiness for general retailers.",
    recommendedCapabilities: ["SHOP", "CRM", "SEO"],
    onboardingChecklist: ["Create public shop page", "Add product categories", "Enable CRM", "Review SEO opportunities"],
    suggestedIntegrations: ["USSD"],
    growthIntelligence: {
      recommendedInotiServices: ["USSD"],
      seoOpportunities: [
        { key: "retail-category-seo", title: "Retail category SEO", description: "Prepare category content recommendations for product discovery.", priority: "MEDIUM" },
        { key: "retail-local-profile", title: "Local business profile", description: "Prepare local profile completeness recommendations.", priority: "MEDIUM" },
      ],
      iamPageBlueprintHints: ["catalog", "categories", "contact channels", "public profile"],
      customerJourneySuggestions: ["Discover catalog", "Contact business", "Save customer profile", "Return through engagement"],
      activationChecklist: ["Publish shop profile", "Add product categories", "Enable CRM", "Prepare SEO brief", "Prepare USSD reach readiness"],
    },
  },
  {
    industryKey: "OTHER",
    displayName: "Other",
    description: "General onboarding path with explicit operator capability selection.",
    recommendedCapabilities: ["CRM", "SEO"],
    onboardingChecklist: ["Create public business page", "Select capabilities", "Add initial business data", "Review growth readiness"],
    suggestedIntegrations: [],
    growthIntelligence: {
      recommendedInotiServices: [],
      seoOpportunities: [
        { key: "general-business-profile", title: "Business profile completeness", description: "Prepare public profile and search readiness recommendations.", priority: "MEDIUM" },
      ],
      iamPageBlueprintHints: ["public profile", "contact channels", "business description"],
      customerJourneySuggestions: ["Discover business", "Contact team", "Save customer profile"],
      activationChecklist: ["Publish business shell", "Confirm capabilities", "Complete public profile", "Prepare SEO readiness"],
    },
  },
] as const satisfies ReadonlyArray<IndustryTemplate>;

export function listIndustryTemplates(): IndustryTemplate[] {
  return INDUSTRY_TEMPLATES.map((template) => ({ ...template }));
}

export function getIndustryTemplate(industryKey: OrganizationIndustryKey): IndustryTemplate {
  const template = INDUSTRY_TEMPLATES.find((entry) => entry.industryKey === industryKey);
  if (!template) return INDUSTRY_TEMPLATES.find((entry) => entry.industryKey === "OTHER")!;
  return { ...template };
}

export function persistedCapabilitiesForRecommendations(
  capabilities: AcquisitionProductCapability[],
): OrganizationCapabilityKey[] {
  return Array.from(
    new Set(
      capabilities.filter((capability): capability is OrganizationCapabilityKey =>
        PLATFORM_CAPABILITIES.has(capability),
      ),
    ),
  );
}

export function organizationTypeForIndustryCapabilities(
  capabilities: OrganizationCapabilityKey[],
): OrganizationType {
  return legacyTypeForCapabilities(capabilities, capabilities.includes("APPOINTMENT") ? "APPOINTMENT" : "SHOP");
}

export function reviewIndustryCapabilityRecommendations(input: {
  industryKey: OrganizationIndustryKey;
  selectedCapabilities?: OrganizationCapabilityKey[];
}) {
  const template = getIndustryTemplate(input.industryKey);
  const recommendedPlatformCapabilities = persistedCapabilitiesForRecommendations(template.recommendedCapabilities);
  const selectedCapabilities = Array.from(new Set(input.selectedCapabilities ?? recommendedPlatformCapabilities));

  return {
    industryTemplate: template,
    recommendedCapabilities: template.recommendedCapabilities,
    recommendedPlatformCapabilities,
    selectedCapabilities,
    organizationType: organizationTypeForIndustryCapabilities(selectedCapabilities),
    onboardingChecklist: template.onboardingChecklist,
    suggestedIntegrations: template.suggestedIntegrations,
  };
}

export function createAcquisitionOnboardingDraft(input: {
  industryKey: OrganizationIndustryKey;
  sourceType?: "BAZARBAAZ_TEAM" | "SALES_AGENT" | "BUSINESS_SELF_SIGNUP" | "INVITATION_CODE";
  selectedCapabilities?: OrganizationCapabilityKey[];
  metadata?: Record<string, unknown>;
}) {
  const review = reviewIndustryCapabilityRecommendations(input);
  return {
    sourceType: input.sourceType ?? "BAZARBAAZ_TEAM",
    activeSource: "BAZARBAAZ_TEAM",
    futureSource: (input.sourceType ?? "BAZARBAAZ_TEAM") !== "BAZARBAAZ_TEAM",
    industryTemplate: review.industryTemplate,
    recommendedCapabilities: review.recommendedCapabilities,
    recommendedPlatformCapabilities: review.recommendedPlatformCapabilities,
    selectedCapabilities: review.selectedCapabilities,
    organizationType: review.organizationType,
    onboardingChecklist: review.onboardingChecklist,
    suggestedIntegrations: review.suggestedIntegrations,
    metadata: input.metadata ?? {},
  };
}
