export type OrganizationSettingsMembership = {
  organizationId: string;
};

export type OrganizationSettingsSession = {
  role?: string | null;
  organizationId?: string | null;
};

export type OrganizationSettingsFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export class OrganizationSettingsScopeError extends Error {
  constructor(readonly reason: "missing" | "forbidden" | "membership") {
    super(reason);
    this.name = "OrganizationSettingsScopeError";
  }
}

const ORGANIZATION_CUID_PATTERN = /^c[a-z0-9]{24}$/i;

export function organizationSettingsApiPath(organizationId: string | null | undefined) {
  const id = organizationId?.trim();
  if (!id || !ORGANIZATION_CUID_PATTERN.test(id)) {
    return null;
  }

  return `/api/organizations/${encodeURIComponent(id)}/settings`;
}

export function resolveOrganizationSettingsId(input: {
  session: OrganizationSettingsSession;
  requestedOrganizationId?: string | null;
  memberships?: OrganizationSettingsMembership[];
}) {
  const requestedId = input.requestedOrganizationId?.trim() || null;

  if (input.session.role === "SUPER_ADMIN") {
    return organizationSettingsApiPath(requestedId) ? requestedId : null;
  }

  const selectedId = input.session.organizationId?.trim() || null;
  if (!selectedId || (requestedId && requestedId !== selectedId)) return null;

  const hasSelectedMembership = input.memberships?.some(
    (membership) => membership.organizationId === selectedId,
  );
  return hasSelectedMembership && organizationSettingsApiPath(selectedId)
    ? selectedId
    : null;
}

export async function requestOrganizationSettings(
  fetcher: OrganizationSettingsFetch,
  organizationId: string | null | undefined,
  init: RequestInit = {},
) {
  const path = organizationSettingsApiPath(organizationId);
  if (!path) throw new OrganizationSettingsScopeError("missing");

  return fetcher(path, {
    cache: "no-store",
    ...init,
  });
}

export async function loadOrganizationSettings(
  fetcher: OrganizationSettingsFetch,
  session: OrganizationSettingsSession,
  requestedOrganizationId?: string | null,
) {
  let memberships: OrganizationSettingsMembership[] = [];

  if (session.role !== "SUPER_ADMIN") {
    const membershipResponse = await fetcher("/api/users/me/membership", {
      cache: "no-store",
    });
    if (!membershipResponse.ok) {
      throw new OrganizationSettingsScopeError("membership");
    }

    const data = (await membershipResponse.json()) as {
      memberships?: OrganizationSettingsMembership[];
    };
    memberships = Array.isArray(data.memberships) ? data.memberships : [];
  }

  const organizationId = resolveOrganizationSettingsId({
    session,
    requestedOrganizationId,
    memberships,
  });
  if (!organizationId) {
    throw new OrganizationSettingsScopeError(
      requestedOrganizationId && session.role !== "SUPER_ADMIN"
        ? "forbidden"
        : "missing",
    );
  }

  const response = await requestOrganizationSettings(fetcher, organizationId, {
    method: "GET",
  });
  if (!response.ok) {
    throw new OrganizationSettingsScopeError(
      response.status === 401 || response.status === 403 ? "forbidden" : "membership",
    );
  }

  return { organizationId, response };
}
