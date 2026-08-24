import { NextRequest, NextResponse } from "next/server";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";
import { inotiUssdProvider } from "@/lib/integrations/inoti-ussd/inoti-provider";
import { environmentInotiCredentialProvider } from "@/lib/integrations/inoti-ussd/credentials";
import { inotiLivePaymentsAllowed, inotiLiveSmsAllowed, inotiMutationSafetyState } from "@/lib/integrations/inoti-runtime-safety";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const platformOrg = await prisma.organization.findFirst({
      where: { slug: "bazarbaaz-platform", isActive: true, deletedAt: null },
      select: { id: true, slug: true, name: true, isPlatformOwner: true },
    });

    if (!platformOrg) {
      return NextResponse.json({ error: "Platform organization not found" }, { status: 404 });
    }

    const ussdIntegration = await prisma.organizationIntegration.findFirst({
      where: { organizationId: platformOrg.id, provider: "INOTI_USSD" },
      select: { id: true, publicId: true, status: true, credentialProfileKey: true, callbackOrigin: true, codeName: true },
    });

    const smsIntegration = await prisma.organizationIntegration.findFirst({
      where: { organizationId: platformOrg.id, provider: "INOTI_SMS" },
      select: { id: true, publicId: true, status: true, credentialProfileKey: true },
    });

    const credentialProfile = await environmentInotiCredentialProvider.resolveProfile(
      platformOrg.id,
      ussdIntegration?.credentialProfileKey ?? null
    );

    const providerCodeNameConfigured = Boolean(credentialProfile?.ussdCodeName);
    const integrationCodeNameConfigured = Boolean(ussdIntegration?.codeName);
    const credentialState = credentialProfile
      ? { resolved: true, hasUsername: Boolean(credentialProfile.username), hasPassword: Boolean(credentialProfile.password), hasSmsToken: Boolean(credentialProfile.smsToken), hasUssdCodeName: providerCodeNameConfigured }
      : { resolved: false, hasUsername: false, hasPassword: false, hasSmsToken: false, hasUssdCodeName: false };

    let getPaymentsResult: { state: string; errorCode?: string | null } = { state: "NOT_CHECKED" };
    if (credentialProfile && ussdIntegration) {
      try {
        const result = await inotiUssdProvider.probeReadOnlyPayments({
          credentialProfile,
          codeName: credentialProfile.ussdCodeName ?? ussdIntegration.codeName ?? null,
          merchantFactorId: "BZ" + "0".repeat(32),
        });
        getPaymentsResult = { state: result.ok ? "VERIFIED_READ_ONLY" : result.code, errorCode: result.code };
      } catch {
        getPaymentsResult = { state: "ERROR" };
      }
    }

    const mutationSafety = inotiMutationSafetyState();

    return NextResponse.json({
      platform: {
        organization: { id: platformOrg.id, slug: platformOrg.slug, name: platformOrg.name, isPlatformOwner: platformOrg.isPlatformOwner },
        ussdIntegration: ussdIntegration ? { id: ussdIntegration.id, publicId: ussdIntegration.publicId, status: ussdIntegration.status, callbackOrigin: ussdIntegration.callbackOrigin } : null,
        smsIntegration: smsIntegration ? { id: smsIntegration.id, publicId: smsIntegration.publicId, status: smsIntegration.status } : null,
      },
      diagnostics: {
        credentialProfile: credentialState,
        ussdCodeName: {
          integrationConfigured: integrationCodeNameConfigured,
          providerConfigured: providerCodeNameConfigured,
          source: providerCodeNameConfigured ? "CREDENTIAL_PROFILE" : integrationCodeNameConfigured ? "INTEGRATION_ROW" : "MISSING",
          matchesProviderConfiguration: providerCodeNameConfigured && integrationCodeNameConfigured
            ? credentialProfile?.ussdCodeName === ussdIntegration?.codeName
            : null,
        },
        getPayments: getPaymentsResult,
      },
      mutationSafety: {
        ...mutationSafety,
        inotiLivePaymentsAllowed: inotiLivePaymentsAllowed(),
        inotiLiveSmsAllowed: inotiLiveSmsAllowed(),
      },
    });
  } catch (error) {
    return jsonError(error, "Failed to run iNoti diagnostics");
  }
}
