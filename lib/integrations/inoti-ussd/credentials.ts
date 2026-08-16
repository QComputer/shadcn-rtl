import "server-only";

import type { InotiCredentialProfile, InotiCredentialProvider } from "@/lib/integrations/inoti-ussd/types";

const DEFAULT_ENDPOINT = "https://login.inoti.com/_services/ExternalUssdPay.asmx";
const PLATFORM_PROFILE_KEY = "INOTI_DEFAULT";

function resolvePlatformProfile(): InotiCredentialProfile | null {
  const username = process.env.INOTI_USSD_USERNAME;
  const password = process.env.INOTI_USSD_PASSWORD;
  if (!username || !password) return null;

  return {
    organizationId: "__platform__",
    profileKey: PLATFORM_PROFILE_KEY,
    username,
    password,
    endpoint: process.env.INOTI_USSD_GET_PAYMENTS_URL || DEFAULT_ENDPOINT,
  };
}

export class EnvironmentInotiCredentialProvider implements InotiCredentialProvider {
  async resolveProfile(organizationId: string, profileKey: string | null): Promise<InotiCredentialProfile | null> {
    if (!profileKey) return null;

    const platform = resolvePlatformProfile();
    if (platform && profileKey === platform.profileKey) {
      if (platform.organizationId !== organizationId) {
        return null;
      }
      return { ...platform, organizationId };
    }

    return null;
  }
}

export const environmentInotiCredentialProvider = new EnvironmentInotiCredentialProvider();
