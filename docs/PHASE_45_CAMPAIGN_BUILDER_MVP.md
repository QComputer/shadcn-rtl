# P45 - Campaign Builder MVP

Date: 2026-06-25

## Scope

P45 adds a simple Customer Club campaign builder on top of the P44 Customer Segments MVP and P43 in-app notification inbox.

This phase sends only in-app notifications. It does not send SMS, email, Telegram, Web Push, or any other external message.

## Runtime Changes

- Added Prisma enums:
  - `CampaignStatus`
  - `CampaignChannel`
  - `CampaignDeliveryStatus`
- Added Prisma models:
  - `Campaign`
  - `CampaignAudience`
  - `CampaignMessage`
  - `CampaignDelivery`
- Added `campaign-builder.service.ts` for:
  - campaign draft creation;
  - segment audience snapshotting;
  - draft updates;
  - dry-run preview;
  - in-app send;
  - pre-send cancellation.
- Added dashboard APIs:
  - `GET /api/dashboard/customer-club/campaigns`
  - `POST /api/dashboard/customer-club/campaigns`
  - `GET /api/dashboard/customer-club/campaigns/[id]`
  - `PATCH /api/dashboard/customer-club/campaigns/[id]`
  - `DELETE /api/dashboard/customer-club/campaigns/[id]`
  - `POST /api/dashboard/customer-club/campaigns/[id]/send`
- Added dashboard pages:
  - `/{locale}/dashboard/customer-club/campaigns`
  - `/{locale}/dashboard/customer-club/campaigns/new`
  - `/{locale}/dashboard/customer-club/campaigns/[id]`
- Linked Customer Segments to Campaigns.

## Access Model

- Campaign APIs require a signed-in session.
- Campaign APIs resolve and verify the requested organization through existing organization guards.
- Campaign APIs require organization `ADMIN`/`MANAGER` access, with existing `SUPER_ADMIN` behavior inherited through guards.
- Campaign dashboard routes are listed in both dashboard route registries.
- Campaign recipient queries are scoped to the current organization only.

## Delivery Behavior

- `dryRun: true` returns the current recipient count and writes an audit log, but creates no `Notification` or `CampaignDelivery` rows.
- Actual send creates one in-app `Notification` row and one `CampaignDelivery` row per recipient.
- Campaign sends use the `CUSTOMER_CLUB_CAMPAIGN_IN_APP` notification type.
- Campaigns can be canceled only while `DRAFT` or `SCHEDULED`.
- External delivery providers are intentionally absent.

## Deferred

- Rich template editor.
- Scheduled background execution.
- Segment materialization at send time beyond current rule evaluation.
- External provider opt-in and consent workflows.
- Campaign analytics beyond delivery row counts.

## Validation

Focused validator:

```powershell
pnpm run quality:campaign-builder
```

Recommended P45 gate:

```powershell
pnpm run db:validate
pnpm run db:generate
pnpm run quality:campaign-builder
pnpm run quality:customer-segments
pnpm run quality:in-app-notifications
pnpm run quality:customer-club-foundation
pnpm run quality:dashboard-route-authorization
pnpm run quality:dashboard-route-parity
pnpm run quality:dashboard-role-navigation
pnpm run quality:local
pnpm run typecheck
pnpm run build
pnpm run release:stage
pnpm run quality:release-staged
```
