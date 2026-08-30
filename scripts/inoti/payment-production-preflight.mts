import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { ensureNextLocalEnvLoaded } from "@/lib/env/load-next-env";

ensureNextLocalEnvLoaded();

const { prisma } = await import("@/lib/db");
const { buildInotiUssdCallbackUrl, isValidInotiUssdPublicIntegrationId } = await import("@/lib/integrations/inoti-ussd/callback-url");
const { getInotiCredentialProfileState } = await import("@/lib/integrations/inoti-ussd/credentials");
const { correlationKeyReadiness } = await import("@/lib/integrations/inoti-ussd/correlation-envelope");
const { evaluateInotiProductionReadiness } = await import("@/lib/payments/inoti-production-readiness");

const targetSlugs = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);
assert.ok(targetSlugs.length > 0, "Usage: tsx scripts/inoti/payment-production-preflight.mts <organization-slug> [...]");
assert.ok(targetSlugs.every((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)), "Organization slugs must be lowercase URL slugs");

const requiredPaymentMigrations = [
  "20260827_organization_branding",
  "20260827_public_home_mode",
  "20260830000100_reconcile_payment_money_semantics",
  "20260830000200_inoti_payment_e2e",
  "20260831000100_inoti_durable_payment_reconciliation",
] as const;
const repositoryMigrations = readdirSync(path.join(process.cwd(), "prisma", "migrations"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

type IntegrationRow = {
  organizationId: string;
  organizationSlug: string;
  organizationActive: boolean;
  publicIntegrationId: string | null;
  provider: string | null;
  integrationStatus: string | null;
  codeName: string | null;
  credentialProfileKey: string | null;
  configuration: unknown;
};

type CountRow = { count: bigint };

const audit = await prisma.$transaction(async (tx) => {
  await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
  const migrationRows = await tx.$queryRawUnsafe<Array<{ migration_name: string }>>(
    `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
  );
  const unresolvedFailedMigrations = await tx.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
  );
  const moneyColumns = await tx.$queryRawUnsafe<Array<{ table_name: string; column_name: string }>>(
    `SELECT table_name::text AS table_name, column_name::text AS column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('PaymentRequest', 'PaymentProviderAttempt') AND column_name IN ('amountRial', 'amountToman') ORDER BY table_name, column_name`,
  );
  const durableTable = await tx.$queryRawUnsafe<Array<{ present: boolean }>>(
    `SELECT to_regclass('public."UssdPaymentVerificationJob"') IS NOT NULL AS present`,
  );
  const durableCounts = durableTable[0]?.present
    ? await tx.$queryRawUnsafe<Array<{ pending: bigint; reconciliation: bigint }>>(
        `SELECT
          COUNT(*) FILTER (WHERE status::text IN ('QUEUED', 'CLAIMED', 'RETRY'))::bigint AS pending,
          COUNT(*) FILTER (WHERE status::text IN ('MANUAL_REVIEW', 'EXHAUSTED'))::bigint AS reconciliation
         FROM "UssdPaymentVerificationJob"`,
      )
    : [{ pending: BigInt(0), reconciliation: BigInt(0) }];
  const integrations = await tx.$queryRawUnsafe<IntegrationRow[]>(
    `SELECT o.id AS "organizationId", o.slug AS "organizationSlug", o."isActive" AS "organizationActive", i."publicId" AS "publicIntegrationId", i.provider::text AS provider, i.status::text AS "integrationStatus", i."codeName", i."credentialProfileKey", i.configuration
     FROM "Organization" o
     LEFT JOIN "OrganizationIntegration" i ON i."organizationId" = o.id AND i.provider::text = 'INOTI_USSD'
     WHERE o.slug = ANY($1::text[]) AND o."deletedAt" IS NULL
     ORDER BY o.slug, i."createdAt"`,
    targetSlugs,
  );
  const duplicateRequests = await tx.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*)::bigint AS count FROM (SELECT "paymentRequestId", "organizationId" FROM "UssdPaymentIntent" WHERE "paymentRequestId" IS NOT NULL GROUP BY 1, 2 HAVING COUNT(*) > 1) duplicate_requests`,
  );
  const requestColumn = moneyColumns.find((column) => column.table_name === "PaymentRequest")?.column_name;
  const attemptColumn = moneyColumns.find((column) => column.table_name === "PaymentProviderAttempt")?.column_name;
  const requestAnomalies = requestColumn
    ? await tx.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*)::bigint AS count FROM "PaymentRequest" WHERE "${requestColumn}" <= 0${requestColumn === "amountRial" ? ` OR "amountRial" % 10 <> 0` : ""}`)
    : [{ count: BigInt(0) }];
  const attemptAnomalies = attemptColumn
    ? await tx.$queryRawUnsafe<CountRow[]>(`SELECT COUNT(*)::bigint AS count FROM "PaymentProviderAttempt" WHERE "${attemptColumn}" <= 0${attemptColumn === "amountRial" ? ` OR "amountRial" % 10 <> 0` : ""}`)
    : [{ count: BigInt(0) }];
  return {
    appliedMigrations: new Set(migrationRows.map((row) => row.migration_name)),
    unresolvedFailedMigrations: Number(unresolvedFailedMigrations[0]?.count ?? BigInt(0)),
    moneyColumns,
    integrations,
    duplicatePaymentRequests: Number(duplicateRequests[0]?.count ?? BigInt(0)),
    requestAmountAnomalies: Number(requestAnomalies[0]?.count ?? BigInt(0)),
    attemptAmountAnomalies: Number(attemptAnomalies[0]?.count ?? BigInt(0)),
    durableTablePresent: durableTable[0]?.present === true,
    pendingVerificationJobs: Number(durableCounts[0]?.pending ?? BigInt(0)),
    reconciliationCount: Number(durableCounts[0]?.reconciliation ?? BigInt(0)),
  };
}, { isolationLevel: "Serializable", timeout: 30_000 });

const missingMigrations = repositoryMigrations.filter((migration) => !audit.appliedMigrations.has(migration));
const schemaReady = missingMigrations.length === 0 &&
  audit.moneyColumns.some((column) => column.table_name === "PaymentRequest" && column.column_name === "amountToman") &&
  audit.moneyColumns.some((column) => column.table_name === "PaymentProviderAttempt" && column.column_name === "amountToman") &&
  audit.unresolvedFailedMigrations === 0 && audit.duplicatePaymentRequests === 0 &&
  audit.requestAmountAnomalies === 0 && audit.attemptAmountAnomalies === 0;
const appRevisionReady = [
  "lib/payments/payment-operations.service.ts",
  "app/api/payments/[publicPaymentId]/route.ts",
  "app/api/organizations/[id]/payments/reconciliation/route.ts",
  "app/api/internal/payments/inoti-verification/route.ts",
].every((relativePath) => existsSync(path.join(process.cwd(), relativePath)));
const encryption = correlationKeyReadiness();

const results = [];
for (const slug of targetSlugs) {
  const integrations = audit.integrations.filter((row) => row.organizationSlug === slug);
  const integration = integrations.length === 1 ? integrations[0] : null;
  const credentials = integration
    ? await getInotiCredentialProfileState({ organizationId: integration.organizationId, profileKey: integration.credentialProfileKey })
    : null;
  const publicIdValid = Boolean(integration?.publicIntegrationId && isValidInotiUssdPublicIntegrationId(integration.publicIntegrationId));
  const callback = publicIdValid ? buildInotiUssdCallbackUrl(integration!.publicIntegrationId!) : null;
  const configuration = integration?.configuration && typeof integration.configuration === "object" && !Array.isArray(integration.configuration)
    ? integration.configuration as Record<string, unknown>
    : {};
  const facts = {
    schemaReady,
    appRevisionReady,
    integrationExists: Boolean(integration?.publicIntegrationId) && integrations.length === 1,
    integrationActive: integration?.integrationStatus === "ACTIVE" && integration.organizationActive,
    providerIsInotiUssd: integration?.provider === "INOTI_USSD",
    codeNamePresent: Boolean(integration?.codeName?.trim()),
    credentialsPresent: credentials?.configured === true,
    callbackValid: Boolean(callback?.startsWith("https://bazarbaaz.ir/api/integrations/inoti/ussd/")),
    tenantPaymentEnabled: configuration.paymentEnabled === true,
    liveVerificationEnabled: process.env.INOTI_USSD_LIVE_VERIFICATION_ENABLED === "true",
    livePaymentEnabled: process.env.INOTI_ALLOW_LIVE_PAYMENTS === "true",
    runtimeMutationsApproved: process.env.INOTI_RUNTIME_MUTATIONS_APPROVED === "true",
    monitoringReady: process.env.INOTI_PAYMENT_MONITORING_READY === "true",
    durableReconciliationReady: audit.durableTablePresent && encryption.configured && process.env.INOTI_PAYMENT_RECONCILIATION_WORKER_READY === "true",
  };
  results.push({
    organizationSlug: slug,
    schema: {
      ready: schemaReady,
      repositoryMigrationCount: repositoryMigrations.length,
      missingMigrations,
      requiredPaymentMigrations,
      unresolvedFailedMigrations: audit.unresolvedFailedMigrations,
      moneyColumns: audit.moneyColumns,
      duplicatePaymentRequests: audit.duplicatePaymentRequests,
      amountAnomalies: audit.requestAmountAnomalies + audit.attemptAmountAnomalies,
      durableVerificationTablePresent: audit.durableTablePresent,
    },
    integration: {
      count: integrations.length,
      active: facts.integrationActive,
      provider: integration?.provider ?? null,
      codeNamePresent: facts.codeNamePresent,
      credentialProfileSupported: credentials ? credentials.state !== "UNSUPPORTED_CREDENTIAL_PROFILE" : false,
      credentialsPresent: facts.credentialsPresent,
      publicIntegrationIdValid: publicIdValid,
      callback,
      paymentEnabled: facts.tenantPaymentEnabled,
    },
    gates: {
      liveVerification: facts.liveVerificationEnabled,
      livePayment: facts.livePaymentEnabled,
      runtimeMutations: facts.runtimeMutationsApproved,
      monitoring: facts.monitoringReady,
      durableReconciliation: facts.durableReconciliationReady,
      encryptionKeyConfigured: encryption.configured,
      encryptionKeyVersion: encryption.activeVersion,
    },
    operations: {
      pendingVerificationJobs: audit.pendingVerificationJobs,
      reconciliationCount: audit.reconciliationCount,
    },
    readiness: evaluateInotiProductionReadiness(facts),
  });
}

console.log(JSON.stringify({ mode: "READ_ONLY", providerCalled: false, targets: results }, null, 2));
await prisma.$disconnect();
