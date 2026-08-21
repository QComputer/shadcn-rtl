# Organization application shell

An Organization is the tenant identity. Its `type` is a legacy compatibility
field only; enabled business modules derive from `OrganizationCapability` once
`capabilitiesInitializedAt` is set.

Supported compositions are `[]`, `[SHOP]`, `[APPOINTMENT]`, and
`[SHOP, APPOINTMENT]`. Plans, memberships, permissions, custom domains, and
feature flags remain separate concerns.

The tenant root is the organization home. Capability paths are composed beneath
that identity: `/shop` for SHOP and `/services` / `/booking` for APPOINTMENT.
Every capability route remains server-enforced, so hiding a navigation entry is
never the authorization boundary.
