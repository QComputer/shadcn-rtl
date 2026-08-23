import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { ensureNextLocalEnvLoaded } from "@/lib/env/load-next-env";

ensureNextLocalEnvLoaded();

const { prisma } = await import("@/lib/db");
const {
  environmentInotiCredentialProvider,
  getInotiCredentialProfileState,
  INOTI_PLATFORM_ORGANIZATION_SLUG,
} = await import("@/lib/integrations/inoti-ussd/credentials");
const { inotiSmsProvider } = await import("@/lib/integrations/inoti-sms/provider");
const { inotiUssdProvider } = await import("@/lib/integrations/inoti-ussd/inoti-provider");
const { buildInotiUssdCallbackUrl } = await import("@/lib/integrations/inoti-ussd/callback-url");
const {
  classifyProviderTimeout,
  diagnoseDns,
  diagnoseHttp,
  diagnoseTcp,
  diagnoseTls,
  latencyBucket,
  secretDiagnostics,
} = await import("@/lib/integrations/inoti-diagnostics");

const databaseUrl = new URL(process.env.DATABASE_URL ?? "https://missing.invalid");
assert.ok(["127.0.0.1", "localhost"].includes(databaseUrl.hostname), "connectivity diagnostics refuses non-local database");

const SMS_HOST = "restful.inoti.com";
const USSD_HOST = "login.inoti.com";
const SMS_ENDPOINT = process.env.INOTI_SMS_ACTIVE_LINES_URL?.trim() || "https://restful.inoti.com/api/SMSAPI/ActiveLines";
const USSD_ENDPOINT = process.env.INOTI_USSD_GET_PAYMENTS_URL?.trim() || "https://login.inoti.com/_services/ExternalUssdPay.asmx";
const USSD_WSDL = `${USSD_ENDPOINT}?WSDL`;

const network = {
  sms: {
    endpoint: SMS_ENDPOINT,
    dns: await diagnoseDns(SMS_HOST),
    tcp443: await diagnoseTcp(SMS_HOST),
    tls: await diagnoseTls(SMS_HOST),
    http: await diagnoseHttp(SMS_ENDPOINT),
  },
  ussd: {
    endpoint: USSD_ENDPOINT,
    wsdl: USSD_WSDL,
    dns: await diagnoseDns(USSD_HOST),
    tcp443: await diagnoseTcp(USSD_HOST),
    tls: await diagnoseTls(USSD_HOST),
    http: await diagnoseHttp(USSD_ENDPOINT),
    wsdlHttp: await diagnoseHttp(USSD_WSDL),
  },
};

const proxyPresence = Object.fromEntries(["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"].map((name) => {
  const value = process.env[name];
  return [name, { present: value !== undefined, nonEmpty: Boolean(value?.trim()) }];
}));

const targets = [
  { business: "Platform / Ahmad Jamali", slug: INOTI_PLATFORM_ORGANIZATION_SLUG, profileKey: "local-env:inoti:platform", readOnly: true },
  { business: "AKA Shoes", slug: "aka-shoes", profileKey: "local-env:inoti:aka-shoes", readOnly: true },
  { business: "Cafe Leo", slug: "cafe-leo", profileKey: "local-env:inoti:cafe-leo", readOnly: true },
  { business: "Restaurant Italiano 13", slug: "italiano-13", profileKey: "local-env:inoti:italiano-13", readOnly: false },
] as const;

const organizations = await prisma.organization.findMany({
  where: { slug: { in: targets.map((target) => target.slug) }, deletedAt: null },
  select: {
    id: true,
    slug: true,
    integrations: {
      where: { provider: "INOTI_USSD" },
      select: { publicId: true },
    },
  },
});
const bySlug = new Map(organizations.map((organization) => [organization.slug, organization]));

async function timed<T>(operation: () => Promise<T>) {
  const start = performance.now();
  const result = await operation();
  const durationMs = Math.round(performance.now() - start);
  return { result, durationMs, latency: latencyBucket(durationMs) };
}

const accountResults = [];
for (const target of targets) {
  const organization = bySlug.get(target.slug) ?? null;
  const organizationId = organization?.id ?? "";
  const credentialState = await getInotiCredentialProfileState({
    organizationId,
    profileKey: target.profileKey,
  });
  const ussdProfile = target.readOnly
    ? await environmentInotiCredentialProvider.resolveProfile(organizationId, target.profileKey)
    : null;
  const smsProfile = target.readOnly
    ? await environmentInotiCredentialProvider.resolveSmsProfile(organizationId, target.profileKey)
    : null;

  const sms = target.readOnly
    ? await timed(() => inotiSmsProvider.activeLinesReadOnly(smsProfile))
    : { result: { ok: false as const, code: "NOT_TESTED" as const }, durationMs: 0, latency: "FAST" as const };
  const rawSmsCode = sms.result.code;
  const smsCode = classifyProviderTimeout({
    providerCode: rawSmsCode,
    dns: network.sms.dns.code,
    tcp: network.sms.tcp443.code,
    tls: network.sms.tls.code,
  });

  const shouldProbeUssd = target.readOnly && Boolean(ussdProfile?.ussdCodeName);
  const ussd = shouldProbeUssd
    ? await timed(() => inotiUssdProvider.probeReadOnlyPayments({
        credentialProfile: ussdProfile,
        codeName: ussdProfile?.ussdCodeName ?? null,
        merchantFactorId: `BZ${randomUUID().replace(/-/g, "")}`,
      }))
    : { result: { ok: false as const, code: target.readOnly ? "NO_CODE_NAME" as const : "NOT_TESTED" as const }, durationMs: 0, latency: "FAST" as const };
  const rawUssdCode = ussd.result.code;
  const ussdCode = classifyProviderTimeout({
    providerCode: rawUssdCode,
    dns: network.ussd.dns.code,
    tcp: network.ussd.tcp443.code,
    tls: network.ussd.tls.code,
  });

  accountResults.push({
    business: target.business,
    slug: target.slug,
    publicIntegrationId: organization?.integrations[0]?.publicId ?? null,
    callbackUrl: organization?.integrations[0]?.publicId ? buildInotiUssdCallbackUrl(organization.integrations[0].publicId) : null,
    credentialState: credentialState.state,
    usernamePasswordPresent: credentialState.configured,
    smsTokenPresent: credentialState.smsTokenConfigured,
    ussdCodeNamePresent: credentialState.ussdCodeNameConfigured,
    ussdDialStringConfigured: credentialState.ussdDialStringConfigured,
    sms: {
      code: smsCode,
      rawProviderCode: rawSmsCode,
      activeLineCount: sms.result.ok ? sms.result.activeLineCount : 0,
      durationMs: sms.durationMs,
      latency: sms.latency,
    },
    ussd: {
      code: ussdCode,
      rawProviderCode: rawUssdCode,
      durationMs: ussd.durationMs,
      latency: ussd.latency,
      codeNameCandidate: target.slug === "cafe-leo" && credentialState.ussdCodeNameConfigured ? "09126511010" : credentialState.ussdCodeNameConfigured ? "CONFIGURED" : "MISSING",
      isAll: false,
      broadEnumeration: false,
    },
  });
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  database: { host: databaseUrl.hostname, port: databaseUrl.port, database: databaseUrl.pathname.replace(/^\//, "") },
  timeoutPolicy: {
    smsRequestTimeoutMs: 8_000,
    ussdRequestTimeoutMs: Number(process.env.INOTI_USSD_TIMEOUT_MS ?? 8_000),
    retries: 0,
  },
  proxyPresence,
  secretNormalization: {
    platformSmsToken: secretDiagnostics(process.env.INOTI_PLATFORM_SMS_TOKEN),
    akaSmsToken: secretDiagnostics(process.env.INOTI_AKA_SHOES_SMS_TOKEN),
    cafeLeoSmsToken: secretDiagnostics(process.env.INOTI_CAFE_LEO_SMS_TOKEN),
    cafeLeoUssdCodeName: secretDiagnostics(process.env.INOTI_CAFE_LEO_USSD_CODE_NAME),
  },
  network,
  accounts: accountResults,
  mutationGates: {
    realSms: "DISABLED",
    realOtp: "DISABLED",
    realPayment: "DISABLED",
  },
}, null, 2));
