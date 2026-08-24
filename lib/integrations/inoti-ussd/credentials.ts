import "server-only";

import { ensureNextLocalEnvLoaded } from "@/lib/env/load-next-env";
import prisma from "@/lib/db";
import type { InotiCredentialProfile, InotiCredentialProvider } from "@/lib/integrations/inoti-ussd/types";

ensureNextLocalEnvLoaded();

const DEFAULT_ENDPOINT = "https://login.inoti.com/_services/ExternalUssdPay.asmx";
const PLATFORM_ORGANIZATION_ID = "__platform__";
const PLATFORM_ORGANIZATION_SLUG = "bazarbaaz-platform";

export type InotiCredentialProfileKey =
  | "INOTI_DEFAULT"
  | "local-env:inoti:platform"
  | "local-env:inoti:aka-shoes"
  | "local-env:inoti:cafe-leo"
  | "local-env:inoti:italiano-13";

export type InotiCredentialProfileState =
  | "NOT_CONFIGURED"
  | "CREDENTIALS_AVAILABLE"
  | "NEEDS_CREDENTIALS"
  | "ORGANIZATION_SCOPE_MISMATCH"
  | "UNSUPPORTED_CREDENTIAL_PROFILE";

type ProfileDefinition = {
  key: InotiCredentialProfileKey;
  usernameEnv: string;
  passwordEnv: string;
  endpointEnv?: string;
  smsTokenEnv?: string;
  ussdCodeNameEnv?: string;
  ussdDialString?: string;
  organizationSlugs: readonly string[];
  platformOnly?: boolean;
};

const PROFILE_DEFINITIONS: readonly ProfileDefinition[] = [
  {
    key: "local-env:inoti:platform",
    usernameEnv: "INOTI_PLATFORM_USERNAME",
    passwordEnv: "INOTI_PLATFORM_PASSWORD",
    endpointEnv: "INOTI_PLATFORM_USSD_ENDPOINT",
    smsTokenEnv: "INOTI_PLATFORM_SMS_TOKEN",
    ussdCodeNameEnv: "INOTI_PLATFORM_USSD_CODE_NAME",
    organizationSlugs: [],
    platformOnly: true,
  },
  {
    key: "local-env:inoti:aka-shoes",
    usernameEnv: "INOTI_AKA_SHOES_USERNAME",
    passwordEnv: "INOTI_AKA_SHOES_PASSWORD",
    endpointEnv: "INOTI_AKA_SHOES_USSD_ENDPOINT",
    smsTokenEnv: "INOTI_AKA_SHOES_SMS_TOKEN",
    ussdCodeNameEnv: "INOTI_AKA_SHOES_USSD_CODE_NAME",
    organizationSlugs: ["aka-shoes"],
  },
  {
    key: "local-env:inoti:cafe-leo",
    usernameEnv: "INOTI_CAFE_LEO_USERNAME",
    passwordEnv: "INOTI_CAFE_LEO_PASSWORD",
    endpointEnv: "INOTI_CAFE_LEO_USSD_ENDPOINT",
    smsTokenEnv: "INOTI_CAFE_LEO_SMS_TOKEN",
    ussdCodeNameEnv: "INOTI_CAFE_LEO_USSD_CODE_NAME",
    ussdDialString: "*6655*1*09126511010#",
    organizationSlugs: ["cafe-leo"],
  },
  {
    key: "local-env:inoti:italiano-13",
    usernameEnv: "INOTI_ITALIANO13_USERNAME",
    passwordEnv: "INOTI_ITALIANO13_PASSWORD",
    endpointEnv: "INOTI_ITALIANO13_USSD_ENDPOINT",
    organizationSlugs: ["italiano-13"],
  },
  {
    key: "INOTI_DEFAULT",
    usernameEnv: "INOTI_USSD_USERNAME",
    passwordEnv: "INOTI_USSD_PASSWORD",
    endpointEnv: "INOTI_USSD_GET_PAYMENTS_URL",
    ussdCodeNameEnv: "INOTI_USSD_CODE_NAME",
    organizationSlugs: [],
    platformOnly: true,
  },
] as const;

function definitionFor(profileKey: string | null | undefined) {
  if (!profileKey) return null;
  return PROFILE_DEFINITIONS.find((definition) => definition.key === profileKey) ?? null;
}

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function credentialsConfigured(definition: ProfileDefinition) {
  return hasValue(process.env[definition.usernameEnv]) && hasValue(process.env[definition.passwordEnv]);
}

function smsTokenConfigured(definition: ProfileDefinition) {
  return hasValue(process.env[definition.smsTokenEnv ?? ""]);
}

function ussdCodeNameConfigured(definition: ProfileDefinition) {
  return hasValue(process.env[definition.ussdCodeNameEnv ?? ""]);
}

async function organizationSlugFor(organizationId: string) {
  if (organizationId === PLATFORM_ORGANIZATION_ID) return null;
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true, deletedAt: null },
    select: { slug: true },
  });
  return organization?.slug ?? null;
}

async function profileAllowedForOrganization(definition: ProfileDefinition, organizationId: string) {
  if (definition.platformOnly) {
    if (organizationId === PLATFORM_ORGANIZATION_ID) return true;
    const slug = await organizationSlugFor(organizationId);
    return slug === PLATFORM_ORGANIZATION_SLUG;
  }
  const slug = await organizationSlugFor(organizationId);
  return Boolean(slug && definition.organizationSlugs.includes(slug));
}

export async function getInotiCredentialProfileState(input: {
  organizationId: string;
  profileKey: string | null;
}): Promise<{
  profileKey: string | null;
  state: InotiCredentialProfileState;
  configured: boolean;
  platformOnly: boolean;
  ussdCodeNameConfigured: boolean;
  smsTokenConfigured: boolean;
  ussdDialStringConfigured: boolean;
}> {
  if (!input.profileKey) {
    return {
      profileKey: null,
      state: "NOT_CONFIGURED",
      configured: false,
      platformOnly: false,
      ussdCodeNameConfigured: false,
      smsTokenConfigured: false,
      ussdDialStringConfigured: false,
    };
  }

  const definition = definitionFor(input.profileKey);
  if (!definition) {
    return {
      profileKey: input.profileKey,
      state: "UNSUPPORTED_CREDENTIAL_PROFILE",
      configured: false,
      platformOnly: false,
      ussdCodeNameConfigured: false,
      smsTokenConfigured: false,
      ussdDialStringConfigured: false,
    };
  }

  const configured = credentialsConfigured(definition);
  const allowed = await profileAllowedForOrganization(definition, input.organizationId);
  if (!allowed) {
    return {
      profileKey: input.profileKey,
      state: "ORGANIZATION_SCOPE_MISMATCH",
      configured,
      platformOnly: definition.platformOnly === true,
      ussdCodeNameConfigured: ussdCodeNameConfigured(definition),
      smsTokenConfigured: smsTokenConfigured(definition),
      ussdDialStringConfigured: hasValue(definition.ussdDialString),
    };
  }
  return {
    profileKey: input.profileKey,
    state: configured ? "CREDENTIALS_AVAILABLE" : "NEEDS_CREDENTIALS",
    configured,
    platformOnly: definition.platformOnly === true,
    ussdCodeNameConfigured: ussdCodeNameConfigured(definition),
    smsTokenConfigured: smsTokenConfigured(definition),
    ussdDialStringConfigured: hasValue(definition.ussdDialString),
  };
}

export class EnvironmentInotiCredentialProvider implements InotiCredentialProvider {
  async resolveProfile(organizationId: string, profileKey: string | null): Promise<InotiCredentialProfile | null> {
    const definition = definitionFor(profileKey);
    if (!definition) return null;
    if (!await profileAllowedForOrganization(definition, organizationId)) return null;
    const username = process.env[definition.usernameEnv]?.trim();
    const password = process.env[definition.passwordEnv]?.trim();
    if (!username || !password) return null;

    return {
      organizationId,
      profileKey: definition.key,
      username,
      password,
      endpoint: process.env[definition.endpointEnv ?? ""]?.trim() || DEFAULT_ENDPOINT,
      smsToken: process.env[definition.smsTokenEnv ?? ""]?.trim() || null,
      ussdCodeName: process.env[definition.ussdCodeNameEnv ?? ""]?.trim() || null,
      ussdDialString: definition.ussdDialString ?? null,
    };
  }

  async resolveSmsProfile(organizationId: string, profileKey: string | null): Promise<InotiCredentialProfile | null> {
    const definition = definitionFor(profileKey);
    if (!definition) return null;
    if (!await profileAllowedForOrganization(definition, organizationId)) return null;
    const smsToken = process.env[definition.smsTokenEnv ?? ""]?.trim();
    if (!smsToken) return null;

    return {
      organizationId,
      profileKey: definition.key,
      username: process.env[definition.usernameEnv]?.trim() || "",
      password: process.env[definition.passwordEnv]?.trim() || "",
      endpoint: process.env[definition.endpointEnv ?? ""]?.trim() || DEFAULT_ENDPOINT,
      smsToken,
      ussdCodeName: process.env[definition.ussdCodeNameEnv ?? ""]?.trim() || null,
      ussdDialString: definition.ussdDialString ?? null,
    };
  }
}

export const environmentInotiCredentialProvider = new EnvironmentInotiCredentialProvider();
export const INOTI_PLATFORM_ORGANIZATION_ID = PLATFORM_ORGANIZATION_ID;
export const INOTI_PLATFORM_ORGANIZATION_SLUG = PLATFORM_ORGANIZATION_SLUG;
