# Organization Integration Foundation

## Scope

BazarBaaz organization integrations are organization-owned external service connections. They are separate from business capabilities:

- capabilities decide what an organization can do;
- integrations describe external systems connected to those capabilities;
- integration secrets are referenced, not stored as plaintext configuration.

## Model

`OrganizationIntegration` is the owned integration record. It keeps existing `INOTI_USSD` compatibility and now also records:

- `provider`: concrete upstream/provider family, such as `INOTI_USSD` or `INOTI_IMENU`;
- `type`: generic product category, such as `USSD`, `IMENU`, `EBC`, `SMS`, or `OTHER`;
- `status`: `DRAFT`, `ACTIVE`, `DISABLED`, or `REVOKED`;
- metadata fields such as `displayName`, `externalAccountId`, and `configuration`;
- `credentialProfileKey`, which is a secret reference only.

`OrganizationIntegrationCapability` links integrations to one or more organization capability keys. This allows one organization to have multiple capabilities and multiple integrations without returning to `Organization.type` as the runtime authority.

## Secret Boundary

Integration configuration is metadata. Plaintext credentials must not be placed in `configuration`; the service rejects secret-looking keys such as password, token, apiKey, username, credential, and privateKey. Sensitive values belong behind a credential profile or future secret provider referenced by `credentialProfileKey`.

## Capability Compatibility

The integration catalog defines provider defaults:

- `INOTI_IMENU` -> `IMENU`, supports `SHOP`;
- `INOTI_USSD` -> `USSD`, supports `USSD`;
- `INOTI_EBC` -> `EBC`, supports `CRM` and `EBC`;
- `SMS` -> `SMS`, supports `CRM` and `SMS`;
- `INOTI_ICV` -> `ICV`, supports `ICV`;
- `INOTI_IAM` -> `IAM`, supports `IAM`;
- `PAYMENT` -> `PAYMENT`, supports `SHOP`;
- `OTHER` -> `OTHER`, no default capability requirement.

The service verifies requested capability links against the organization's effective active capabilities before creating or activating an integration.

## API Foundation

The generic organization-scoped endpoints are:

- `GET /api/organizations/:id/integrations`
- `POST /api/organizations/:id/integrations`
- `GET /api/organizations/:id/integrations/:integrationId`
- `PATCH /api/organizations/:id/integrations/:integrationId`

They use the existing tenant context guard. Admins and managers can create and change lifecycle status; staff can read.

## USSD Readiness

USSD remains provider-specific under the existing iNoti USSD callback and payment foundation. The generic layer prepares the ownership model for future USSD sessions:

- the integration has a public identifier for callback routing;
- the integration belongs to exactly one organization;
- callback/session records continue to scope by integration and organization;
- organization-specific USSD metadata can live in non-secret `configuration`;
- credentials remain external through `credentialProfileKey`.
