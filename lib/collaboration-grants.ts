export type CollaborationGrantRecord = {
  ownerOrgId: string
  partnerOrgId: string
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "REVOKED"
  startsAt?: Date | null
  endsAt?: Date | null
  scopes: Array<{
    scope: string
    ownerToPartner: boolean
    partnerToOwner: boolean
    writeAccess: boolean
  }>
}

/**
 * Evaluates only an explicit collaboration grant. Callers must still pass base
 * tenant authorization first; this function never grants broad tenant access.
 */
export function evaluateOrganizationCollaborationGrant(input: {
  collaboration: CollaborationGrantRecord | null
  actorOrganizationId: string
  resourceOrganizationId: string
  scope: string
  access: "READ" | "WRITE"
  now?: Date
}): boolean {
  const { collaboration } = input
  if (!collaboration || collaboration.status !== "ACTIVE") return false

  const now = input.now ?? new Date()
  if (collaboration.startsAt && collaboration.startsAt > now) return false
  if (collaboration.endsAt && collaboration.endsAt <= now) return false

  const ownerToPartner = input.resourceOrganizationId === collaboration.ownerOrgId
    && input.actorOrganizationId === collaboration.partnerOrgId
  const partnerToOwner = input.resourceOrganizationId === collaboration.partnerOrgId
    && input.actorOrganizationId === collaboration.ownerOrgId
  if (!ownerToPartner && !partnerToOwner) return false

  const scope = collaboration.scopes.find((item) => item.scope === input.scope)
  if (!scope) return false
  if (input.access === "WRITE" && !scope.writeAccess) return false

  return ownerToPartner ? scope.ownerToPartner : scope.partnerToOwner
}
