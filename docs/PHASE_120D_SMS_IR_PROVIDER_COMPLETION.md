# P120D — SMS.ir Provider Completion

_Last updated: 2026-07-04._

P120D is accepted only after P120D-FIX2 leaves `quality:local` green.

## Goal

Complete the SMS service so Bazar Baz can safely use sms.ir for transactional messages with full observability, while keeping real sends disabled by default and maintaining all existing P120A/P120B/P120C notification flows.

## What Changed

### Server-only sms.ir REST client

Added `lib/sms/sms-ir-client.server.ts` with a `validateServerOnly()` guard that throws in browser contexts. The client uses `fetch` with `AbortController` timeouts and stores the API key only in the `X-API-KEY` header server-side.

Implemented endpoints:
- `GET /v1/line` - list available sender lines
- `POST /v1/send/bulk` - send identical SMS to multiple recipients (max 100)
- `POST /v1/send/likeToLike` - send personalized SMS per recipient (max 100)
- `POST /v1/send/verify` - verify code delivery (preserved from P101)

### Phone normalization and validation

Added `lib/sms/phone-normalization.ts` and `lib/sms/sms-ir-validation.ts`:
- Normalize Iranian mobiles to `09xxxxxxxxx` from inputs like `0912xxxxxxx`, `912xxxxxxx`, `+98912xxxxxxx`, `0098912xxxxxxx`
- Mask phones for logs (`0912***1234`)
- Enforce max 100 recipients per request
- Validate like-to-like message count equals mobile count
- Validate scheduled sends: null only, or valid Unix timestamp 1 hour to 365 days in future

### SmsService integration

Updated `lib/sms/index.ts` with new methods:
- `sendBulk()` - bulk SMS delivery with `SmsDelivery` rows
- `sendLikeToLike()` - personalized per-recipient SMS with `SmsDelivery` rows
- `sendTextToPhone()` - direct phone send with dry-run/real-send support, used for guest SMS
- `getProviderLines()` - safe dashboard line list
- `normalizeIranianMobile()` - exported for router reuse

### Real-send gates

Real SMS sending requires ALL of:
- `SMS_PROVIDER=sms_ir`
- `SMS_REAL_SEND_ENABLED=true`
- `SMS_DRY_RUN=false`
- `SMS_IR_API_KEY` present
- `SMS_IR_DEFAULT_LINE_NUMBER` present
- `SMS_IR_ALLOW_REAL_SEND_ACK=I_UNDERSTAND_REAL_SMS_WILL_BE_SENT`
- `DEPLOYED_ALLOW_REAL_SMS=1` or `SMS_REAL_SEND_OPERATOR_CONFIRMED=1`

Guest real send (optional, not enabled by default) requires all above plus:
- `SMS_GUEST_REAL_SEND_ENABLED=true`
- `SMS_GUEST_ALLOW_REAL_SEND_ACK=I_UNDERSTAND_GUEST_REAL_SMS_WILL_BE_SENT`

### Dashboard diagnostics

Added server-only diagnostic endpoints:
- `GET /api/dashboard/notification-operations/sms-ir/status` - returns safe config flags without exposing the API key
- `GET /api/dashboard/notification-operations/sms-ir/lines` - returns sender lines for admin/super admin roles

### Guest SMS dry-run improvement

Guest lifecycle SMS now flows through `smsService.sendTextToPhone({ dryRun: true })`, creating real `SmsDelivery` rows with `dryRun=true` and `status=DRY_RUN`. This improves observability while keeping guest real SMS hard-blocked unless explicit gates are enabled.

## Schema Migration

Added `20260703000300_sms_delivery_guest_customer` migration to make `SmsDelivery.customerId` nullable. This supports:
- Bulk/like-to-like sends to arbitrary phone numbers
- Guest SMS dry-run records without a linked registered customer

## Environment Variables

Added to `.env.example`:
```env
SMS_PROVIDER=DRY_RUN
SMS_DRY_RUN=true
SMS_REAL_SEND_ENABLED=false
DEPLOYED_ALLOW_REAL_SMS=0
SMS_IR_ALLOW_REAL_SEND_ACK=
SMS_IR_ALLOWED_TEST_RECIPIENTS=
SMS_GUEST_REAL_SEND_ENABLED=false
SMS_GUEST_ALLOW_REAL_SEND_ACK=
```

## Security

- `sms.ir API key remains server-only; never exposed to browser`
- No hardcoded API keys; no pasted keys in source
- Real SMS is disabled by default
- Tests and validators never send real SMS
- Guest real SMS is hard-blocked by default

## Validation

Added validators:
- `quality:sms-ir-provider-completion` - checks client exists, server-only guard, endpoints, normalization, validation, dashboard safety
- `quality:sms-real-send-gates` - checks env defaults, ACK gates, no client calls, no hardcoded keys

## Known Limitations

- Actual retry execution/resend remains deferred from P120C
- Like-to-like messages require exact length match with mobiles
- `sendDateTime` scheduling is not yet exposed via dashboard UI
- Delivery report reconciliation (P120E) is not implemented

## Before / After

### Before P120D
- sms.ir provider had single-recipient bulk wrapper only
- No GET /v1/line endpoint
- No like-to-like send
- No phone normalization helpers
- No schedule validation
- No dashboard SMS diagnostics
- Guest SMS only recorded delivery attempts, not `SmsDelivery` rows
- `SmsDelivery.customerId` was required, blocking guest/admin-initiated sends

### After P120D
- Full sms.ir REST client with GET lines, POST bulk, POST likeToLike, POST verify
- Server-only guard prevents browser usage
- Iranian mobile normalization and masking
- Schedule and recipient count validation
- Dashboard status/line endpoints with auth
- Guest SMS creates `SmsDelivery` rows via `sendTextToPhone` with `dryRun=true`
- `customerId` nullable supports non-customer sends

## Exit Criteria

- Typecheck passes
- Build passes
- `quality:sms-ir-provider-completion` passes
- `quality:sms-real-send-gates` passes
- `quality:local` is green after FIX2
- Existing notification validators (`quality:guest-sms-dry-run`, `quality:customer-order-lifecycle-notifications`, `quality:notification-delivery-observability`, `quality:notification-routing`, `quality:notification-operations`) pass
- Real SMS remains disabled by default
