# Integration Runtime Foundation

## Scope

The runtime foundation lets organization integrations participate in workflows without putting provider-specific conditionals throughout the codebase. It does not call production providers or implement full USSD menus.

## Adapter System

`IntegrationAdapter` defines the provider boundary:

- validate non-secret configuration;
- report dry-run health;
- execute declared runtime actions;
- expose supported actions and capabilities.

The current adapters are dry-run only. `InotiUssdAdapter` adds `USSD_SESSION_START` support, while other provider adapters use the generic dry-run behavior.

## Registry

`getIntegrationAdapter(provider)` is the single adapter lookup point. Services call the registry instead of branching on providers.

## Health Model

`OrganizationIntegration` now stores a health snapshot:

- `healthStatus`;
- `lastHealthCheckedAt`;
- `lastHealthErrorCode`;
- `lastHealthErrorMessage`;
- `healthMetadata`.

Health checks are local dry-run checks and write a sanitized business event.

## Business Events

`BusinessEvent` is an organization-scoped domain event record for future CRM, loyalty, campaign, USSD, and AI workflows. Payload and metadata use the same secret-key rejection policy as integration configuration.

Initial event types:

- `ORDER_CREATED`
- `CUSTOMER_CREATED`
- `PAYMENT_COMPLETED`
- `USSD_SESSION_STARTED`
- `INTEGRATION_CONNECTED`
- `INTEGRATION_HEALTH_CHECKED`

## USSD Runtime Preparation

`UssdSession` prepares session ownership for future `*87788778#` flow handling:

- organization-scoped;
- integration-scoped;
- stores only hashed provider session identifiers;
- optional customer or guest customer reference;
- state and metadata JSON for future menu flow state.

Starting a session requires an active USSD integration and goes through the adapter runtime action boundary.

## Security

Runtime services fail closed on cross-tenant integration IDs. Event payloads and runtime metadata reject obvious credential keys such as passwords, tokens, API keys, private keys, usernames, and credential fields.
