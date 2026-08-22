# Demo Universe Backend Foundation

The Demo Universe backend prepares BazarBaaz for a guided public experience that can show a complete business lifecycle without touching production integrations or real provider credentials.

## CRM read model

The CRM layer is organization-scoped and computed from existing customer identity, customer interaction, business event, order, user, and guest customer data. It does not create campaign, loyalty-rule, or CRM workflow tables.

Endpoints:

- `GET /api/organizations/:organizationId/customers`
- `GET /api/organizations/:organizationId/customers/:customerId/summary`

The list endpoint supports bounded pagination and safe search across tenant-local customer phone/email/name signals. Phone lookup uses the existing tenant-scoped customer identity hash and never performs a global phone-number lookup.

## Demo organization model

Demo organizations use existing `Organization` and `OrganizationSettings.settings` data:

```json
{
  "demo": {
    "enabled": true,
    "roles": ["CUSTOMER", "MANAGER", "STAFF", "DRIVER"]
  }
}
```

The helper in `lib/demo-universe/demo-organization.ts` validates the shape and exposes role capability definitions for future UI entry points.

## Demo session security

`DemoSessionToken` stores only a hash of the temporary token. Demo sessions are:

- organization-scoped
- role-scoped
- expiring
- revocable
- valid only for demo-enabled organizations

They do not use real passwords, SMS verification, or external authentication.

## Event-driven demo flow

Demo scenario actions reuse the existing `BusinessEvent` and `CustomerInteraction` foundations. Order lifecycle transitions can emit:

- `ORDER_ACCEPTED`
- `ORDER_PREPARING`
- `ORDER_READY`
- `ORDER_OUT_FOR_DELIVERY`
- `ORDER_COMPLETED`

The scenario engine records order status history, emits business events, links interactions to the resolved customer identity when one exists, and stores guided-step completion in `DemoProgress`.

## Integration showcase readiness

Readiness is derived from active capabilities and configured organization integrations:

- iMenu: `SHOP`
- iCV: `ICV`
- iAM: `IAM`
- EBC: `CRM` or `EBC`
- USSD: `USSD`

No real provider calls are made.

## External catalog foundation

`ExternalCatalogConnection`, `ExternalCatalogItem`, and `CatalogSyncRun` provide an additive foundation for future marketplace/menu-provider imports. The current connectors are mock-only and support preview analysis for SnappFood/EZY/manual-import style providers.

Preview imports are tenant-scoped and isolated:

- connection ownership is checked by organization
- preview items are stored separately from live catalog tables
- no product/category publishing happens during preview
- provider credentials are sanitized before persistence
