import type { OrganizationCapabilityKey } from "@prisma/client";
import type { DemoShowcaseIndustry, DemoShowcaseRoleExperience, DemoShowcaseStep } from "@/lib/demo-universe/demo-showcase-blueprints";
import type { DemoWalkthroughStage } from "@/lib/demo-universe/demo-walkthrough";
import type { DemoRole } from "@/lib/public-experience/types";

const CAPABILITY_KEYS = ["SHOP", "APPOINTMENT", "CRM", "USSD", "LOYALTY", "IAM", "ICV", "EBC", "SMS"] as const;
const INDUSTRIES = ["PHARMACY", "DENTAL_CLINIC", "CAFE_RESTAURANT", "FASHION_BOUTIQUE"] as const;
const DEMO_ROLE_KEYS = ["PLATFORM_ADMIN", "ORGANIZATION_OWNER", "CUSTOMER", "MANAGER", "STAFF", "DRIVER"] as const;
const WALKTHROUGH_STAGES = ["DIGITAL_PRESENCE", "BUSINESS_OPERATIONS", "CUSTOMER_INTELLIGENCE", "GROWTH_INTELLIGENCE", "CUSTOMER_ENGAGEMENT"] as const;

export type PublicDemoShowcase = {
  organization: {
    id: string;
    name: string;
    slug: string;
    locale: string;
    logo?: string | null;
    coverImage?: string | null;
    description?: string | null;
  };
  industry: DemoShowcaseIndustry;
  industryLabel: string;
  tagline: string;
  capabilities: OrganizationCapabilityKey[];
  demoRoles: DemoRole[];
  highlights: string[];
  roleExperiences: DemoShowcaseRoleExperience[];
  storySteps: DemoShowcaseStep[];
  cta: {
    label: string;
    route: string;
    sessionRoute: string;
  };
  artifacts: string[];
};

export type DemoShowcaseSettings = Omit<PublicDemoShowcase, "organization" | "cta"> & {
  featured?: boolean;
  ctaLabel?: string;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringList(value: unknown, limit = 8) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, limit) : [];
}

function isDemoRole(value: unknown): value is DemoRole {
  return typeof value === "string" && DEMO_ROLE_KEYS.includes(value as DemoRole);
}

function isCapability(value: unknown): value is OrganizationCapabilityKey {
  return typeof value === "string" && CAPABILITY_KEYS.includes(value as OrganizationCapabilityKey);
}

function isIndustry(value: unknown): value is DemoShowcaseIndustry {
  return typeof value === "string" && INDUSTRIES.includes(value as DemoShowcaseIndustry);
}

function isWalkthroughStage(value: unknown): value is DemoWalkthroughStage {
  return typeof value === "string" && WALKTHROUGH_STAGES.includes(value as DemoWalkthroughStage);
}

function parseRoleExperiences(value: unknown, allowedRoles: DemoRole[]): DemoShowcaseRoleExperience[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const entry = objectValue(item);
    if (!isDemoRole(entry.role) || !allowedRoles.includes(entry.role)) return [];
    return [{
      role: entry.role,
      title: stringValue(entry.title),
      description: stringValue(entry.description),
      routeHint: stringValue(entry.routeHint, `/demo?role=${entry.role}`),
    }];
  }).slice(0, 8);
}

function parseStorySteps(value: unknown, allowedRoles: DemoRole[]): DemoShowcaseStep[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    const entry = objectValue(item);
    if (!isDemoRole(entry.role) || !allowedRoles.includes(entry.role)) return [];
    const key = stringValue(entry.key);
    const title = stringValue(entry.title);
    if (!key || !title) return [];
    return [{
      key,
      title,
      description: stringValue(entry.description),
      role: entry.role,
      action: stringValue(entry.action, "VIEW"),
      sortOrder: typeof entry.sortOrder === "number" ? entry.sortOrder : (index + 1) * 10,
      businessValue: stringValue(entry.businessValue),
      relatedCapability: isCapability(entry.relatedCapability) ? entry.relatedCapability : "CRM",
      artifact: stringValue(entry.artifact),
      stage: isWalkthroughStage(entry.stage) ? entry.stage : "BUSINESS_OPERATIONS",
    }];
  }).sort((a, b) => a.sortOrder - b.sortOrder).slice(0, 8);
}

export function parseDemoShowcaseSettings(value: unknown): DemoShowcaseSettings | null {
  const showcase = objectValue(value);
  if (!isIndustry(showcase.industry)) return null;
  const demoRoles = Array.isArray(showcase.demoRoles) ? showcase.demoRoles.filter(isDemoRole) : [];
  if (demoRoles.length === 0) return null;
  return {
    featured: showcase.featured === true,
    industry: showcase.industry,
    industryLabel: stringValue(showcase.industryLabel),
    tagline: stringValue(showcase.tagline),
    capabilities: Array.isArray(showcase.capabilities) ? showcase.capabilities.filter(isCapability) : [],
    demoRoles,
    highlights: stringList(showcase.highlights),
    roleExperiences: parseRoleExperiences(showcase.roleExperiences, demoRoles),
    storySteps: parseStorySteps(showcase.storySteps, demoRoles),
    ctaLabel: stringValue(showcase.ctaLabel),
    artifacts: stringList(showcase.artifacts),
  };
}

export function buildPublicDemoShowcase(input: {
  organization: {
    id: string;
    name: string;
    slug: string;
    locale: string;
    logo?: string | null;
    coverImage?: string | null;
    description?: string | null;
  };
  settings: unknown;
}): PublicDemoShowcase | null {
  const root = objectValue(input.settings);
  const demo = objectValue(root.demo);
  const showcase = parseDemoShowcaseSettings(demo.showcase);
  if (!showcase) return null;
  return {
    organization: {
      id: input.organization.id,
      name: input.organization.name,
      slug: input.organization.slug,
      locale: input.organization.locale,
      logo: input.organization.logo ?? null,
      coverImage: input.organization.coverImage ?? null,
      description: input.organization.description ?? null,
    },
    industry: showcase.industry,
    industryLabel: showcase.industryLabel,
    tagline: showcase.tagline,
    capabilities: showcase.capabilities,
    demoRoles: showcase.demoRoles,
    highlights: showcase.highlights,
    roleExperiences: showcase.roleExperiences,
    storySteps: showcase.storySteps,
    cta: {
      label: showcase.ctaLabel || "شروع دمو",
      route: `/${input.organization.locale}/demo/${input.organization.slug}`,
      sessionRoute: `/api/public/demo/${input.organization.slug}/session`,
    },
    artifacts: showcase.artifacts,
  };
}
