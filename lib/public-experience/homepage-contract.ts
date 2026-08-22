import { DEMO_STORY_STEPS } from "@/lib/public-experience/demo-storytelling";

export function getHomepageBackendContract() {
  return {
    hero: { source: "platform-feature-model", includes: ["headline", "summary", "primaryCta", "demoCta"] },
    problem: { source: "homepage-content", includes: ["painPoints", "marketContext"] },
    solution: { source: "platform-feature-model", includes: ["featureCategories", "capabilityMap"] },
    howItWorks: { source: "demo-storytelling-layer", includes: DEMO_STORY_STEPS.map((step) => step.key) },
    businessExamples: { source: "public-demo-organizations", includes: ["featuredDemoOrganizations", "capabilities"] },
    inotiEcosystem: { source: "integration-runtime-foundation", includes: ["iMenu", "iAM", "iCV", "EBC", "USSD"] },
    demoCta: { source: "public-demo-experience", includes: ["journeys", "demoLinks"] },
  };
}
