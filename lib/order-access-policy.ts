export const PUBLIC_ORDER_ORGANIZATION_READER_ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;

export function isOrganizationOrderReaderRole(role: string) {
  return (PUBLIC_ORDER_ORGANIZATION_READER_ROLES as readonly string[]).includes(role);
}

