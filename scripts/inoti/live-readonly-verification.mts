import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ensureNextLocalEnvLoaded } from "@/lib/env/load-next-env";

ensureNextLocalEnvLoaded();

const { prisma } = await import("@/lib/db");
const {
  environmentInotiCredentialProvider,
  getInotiCredentialProfileState,
  INOTI_PLATFORM_ORGANIZATION_SLUG,
} = await import("@/lib/integrations/inoti-ussd/credentials");
const { buildInotiUssdCallbackUrl, isValidInotiUssdPublicIntegrationId } = await import("@/lib/integrations/inoti-ussd/callback-url");
const { inotiSmsProvider } = await import("@/lib/integrations/inoti-sms/provider");
const { inotiUssdProvider } = await import("@/lib/integrations/inoti-ussd/inoti-provider");

const databaseUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(
  ["127.0.0.1", "localhost"].includes(databaseUrl.hostname),
  "live-readonly-verification refuses to run against a non-local database",
);

type Target = {
  business: string;
  slug: string | null;
  organizationId: string;
  profileKey: "local-env:inoti:platform" | "local-env:inoti:aka-shoes" | "local-env:inoti:cafe-leo" | "local-env:inoti:italiano-13";
  liveVerificationAllowed: boolean;
};

const targets: Target[] = [
  { business: "Platform / Ahmad Jamali", slug: INOTI_PLATFORM_ORGANIZATION_SLUG, organizationId: "", profileKey: "local-env:inoti:platform", liveVerificationAllowed: true },
  { business: "AKA Shoes", slug: "aka-shoes", organizationId: "", profileKey: "local-env:inoti:aka-shoes", liveVerificationAllowed: true },
  { business: "Cafe Leo", slug: "cafe-leo", organizationId: "", profileKey: "local-env:inoti:cafe-leo", liveVerificationAllowed: true },
  { business: "Restaurant Italiano 13", slug: "italiano-13", organizationId: "", profileKey: "local-env:inoti:italiano-13", liveVerificationAllowed: false },
];

async function hydrateTargets() {
  const slugs = targets.map((target) => target.slug).filter((slug): slug is string => Boolean(slug));
  const organizations = await prisma.organization.findMany({
    where: { slug: { in: slugs }, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      integrations: {
        where: { provider: "INOTI_USSD" },
        select: { id: true, publicId: true, status: true, codeName: true, credentialProfileKey: true },
      },
    },
  });
  const bySlug = new Map(organizations.map((organization) => [organization.slug, organization]));
  return targets.map((target) => ({
    ...target,
    organization: target.slug ? bySlug.get(target.slug) ?? null : null,
    organizationId: target.slug ? bySlug.get(target.slug)?.id ?? "" : target.organizationId,
  }));
}

const hydrated = await hydrateTargets();

const allUssdIntegrations = await prisma.organizationIntegration.findMany({
  where: { provider: "INOTI_USSD" },
  select: {
    id: true,
    publicId: true,
    status: true,
    codeName: true,
    credentialProfileKey: true,
    organization: { select: { name: true, slug: true } },
  },
  orderBy: [{ organization: { slug: "asc" } }],
});

const publicIds = new Map<string, number>();
for (const integration of allUssdIntegrations) {
  publicIds.set(integration.publicId, (publicIds.get(integration.publicId) ?? 0) + 1);
}

const results = [];
for (const target of hydrated) {
  const integration = target.organization?.integrations[0] ?? null;
  const credentialState = await getInotiCredentialProfileState({
    organizationId: target.organizationId,
    profileKey: target.profileKey,
  });
  const ussdProfile = target.liveVerificationAllowed
    ? await environmentInotiCredentialProvider.resolveProfile(target.organizationId, target.profileKey)
    : null;
  const smsProfile = target.liveVerificationAllowed
    ? await environmentInotiCredentialProvider.resolveSmsProfile(target.organizationId, target.profileKey)
    : null;

  const smsResult = target.liveVerificationAllowed
    ? await inotiSmsProvider.activeLinesReadOnly(smsProfile)
    : { ok: false as const, code: "NOT_TESTED" };
  const ussdResult = target.liveVerificationAllowed
    ? await inotiUssdProvider.probeReadOnlyPayments({
      credentialProfile: ussdProfile,
      codeName: ussdProfile?.ussdCodeName ?? null,
      merchantFactorId: `BZ${randomUUID().replace(/-/g, "")}`,
    })
    : { ok: false as const, code: "NOT_TESTED" };

  results.push({
    business: target.business,
    organizationSlug: target.slug,
    publicIntegrationId: integration?.publicId ?? "NO_USSD_INTEGRATION",
    publicIntegrationIdValid: integration ? isValidInotiUssdPublicIntegrationId(integration.publicId) : false,
    duplicatePublicIntegrationId: integration ? (publicIds.get(integration.publicId) ?? 0) > 1 : false,
    ussdWebServiceUrl: integration ? buildInotiUssdCallbackUrl(integration.publicId) : "NO_USSD_INTEGRATION",
    credentials: credentialState.configured,
    smsToken: credentialState.smsTokenConfigured,
    ussdCodeName: credentialState.ussdCodeNameConfigured,
    smsReadOnly: smsResult.code,
    activeLineCount: smsResult.ok ? smsResult.activeLineCount : 0,
    ussdReadOnly: ussdResult.code,
    liveSms: "DISABLED",
    liveOtp: "DISABLED",
    livePayment: "DISABLED",
  });
}

const integrationAudit = allUssdIntegrations.map((integration) => ({
  business: integration.organization.name,
  slug: integration.organization.slug,
  status: integration.status,
  publicIntegrationId: integration.publicId,
  valid: isValidInotiUssdPublicIntegrationId(integration.publicId),
  duplicate: (publicIds.get(integration.publicId) ?? 0) > 1,
  ussdWebServiceUrl: buildInotiUssdCallbackUrl(integration.publicId),
}));

console.log(JSON.stringify({
  database: { host: databaseUrl.hostname, port: databaseUrl.port, database: databaseUrl.pathname.replace(/^\//, "") },
  targets: results,
  allUssdIntegrations: integrationAudit,
}, null, 2));
