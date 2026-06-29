# Phase 101 - SMS provider abstraction and sms.ir integration

P101 adds the server-only SMS provider boundary required before SMS is connected to appointment, order, or campaign workflows.

## Implemented

- Added `SmsDeliveryStatus` and `SmsDelivery` to Prisma for dry-run and real SMS delivery records.
- Added `lib/sms/*` with:
  - shared SMS types and masked phone helper;
  - dry-run provider as the default provider;
  - sms.ir REST provider using the `X-API-KEY` header and `/v1/send/bulk` plus `/v1/send/verify`;
  - a single provider factory and `smsService`.
- Added SMS runtime configuration with dry-run default behavior.
- Added runtime environment validation for:
  - allowed providers: `dry_run` / `sms_ir`;
  - real sms.ir sends requiring `SMS_IR_API_KEY` and `SMS_IR_LINE_NUMBER` or `SMS_IR_LINE`;
  - warnings when real SMS is enabled outside production.
- Reused `notificationPreferencesService` through `isCustomerDeliveryAllowed()` before SMS sends.
- Stored only masked phone numbers in SMS delivery rows and audit metadata.
- Added P101 quality gate through `quality:sms-provider`.

## Safety policy

- `SMS_PROVIDER=DRY_RUN` and `SMS_DRY_RUN=true` remain safe defaults.
- No route handler or business workflow should import sms.ir directly.
- Future workflows should call `smsService` so preference checks, delivery records, masking, and env gates are applied consistently.
- Real SMS delivery must be enabled only by production secret configuration.
- API keys must not appear in logs, health responses, docs, seed data, tests, or committed env files.

## Validation

```powershell
pnpm run db:generate
pnpm run db:validate
pnpm run quality:sms-provider
pnpm run quality:notification-preferences
pnpm run quality:web-push-delivery
pnpm run quality:source-baseline
pnpm run quality:local
pnpm run typecheck
pnpm run build
```

## Next

- Notification templates, routing, and delivery policies.
- Admin/operator notification dashboard.
- Deployed PWA, Push, and SMS smoke coverage.
