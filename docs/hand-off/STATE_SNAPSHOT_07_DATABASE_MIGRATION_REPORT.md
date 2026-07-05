# STATE-SNAPSHOT-07: Database and Migration Report

Generated: 2026-07-05
Project: Bazar Baz / shadcn-rtl

## Prisma Schema Summary
- **Provider**: PostgreSQL
- **Connection**: Neon serverless (`ep-little-river-aifwxtf7-pooler.c-4.us-east-1.aws.neon.tech`)
- **Models**: 67 Prisma models
- **Enums**: NotificationDeliveryAttemptStatus, CreativeStudioUsageAction, PushPermissionState, UserRole, OrganizationType, OrderStatus, PaymentStatus, ReviewStatus, CampaignStatus, etc.
- **Multi-tenancy**: Organization + OrganizationMember pattern
- **Soft deletes**: `deletedAt` fields on Organization, Order, Product, Service, etc.
- **Audit**: AuditLog model present

## Migration List (32 migrations)
```
20260419151324
20260419151614
20260419151716
20260421141131
20260423070615
20260424161030_order_message
20260425095640
20260426151019
20260427144858
20260428000522
20260520220000_phase3_membership_roles
20260520230000_phase5_order_payment_hardening
20260521000000_phase7_media_hardening
20260521010000_phase8_audit_softdelete_notifications
20260521020000_phase14_inventory_movements
20260521030000_phase15_public_order_tracking
20260607161713_add_product_discount_fields
20260607224237_add_delivery_coordinates
20260609000000_add_organization_coordinates
20260609002000_add_order_organization_slug
20260609003000_add_order_deleted_at
20260609004000_add_fanpage_posts
20260611015106_add_fanpage_video
20260625000100_customer_club_foundation
20260625000200_in_app_notification_inbox
20260625000300_customer_segments_mvp
20260625000400_campaign_builder_mvp
20260625000500_loyalty_coupons
20260625000600_web_push_foundation
20260627000100_category_slugs
20260627000200_product_service_slugs
20260627000300_shop_custom_domains
20260628000100_import_hub_foundation
20260628000200_csv_excel_product_importer
20260628000300_export_hub_foundation
20260628000400_add_ai_media_job
20260629000400_notification_preferences
20260629000500_web_push_delivery
20260629000600_sms_provider_delivery
20260629008700_add_ai_media_usage_events
20260629008900_imported_product_ai_media_bridge
20260630000100_creative_studio_foundation
20260703000100_add_creative_studio_asset_rolled_back
20260703000200_notification_delivery_attempt
20260703000300_sms_delivery_guest_customer
```

## Latest Migration
- `20260703000300_sms_delivery_guest_customer`

## Notification/SMS Relevant Migrations
- `20260521010000_phase8_audit_softdelete_notifications` — Notification, push, SMS delivery models
- `20260625000200_in_app_notification_inbox` — In-app notification inbox
- `20260629000400_notification_preferences` — Notification preferences
- `20260629000500_web_push_delivery` — Web Push delivery records
- `20260629000600_sms_provider_delivery` — SMS delivery records
- `20260703000200_notification_delivery_attempt` — Unified delivery observability
- `20260703000300_sms_delivery_guest_customer` — SMS guest customer support

## Local Migration Status
- **db:generate**: Passed
- **db:validate**: Passed
- **db:migrate**: Blocked by local Neon DB connectivity (pooler unreachable from this runner)
- **prisma migrate status**: Not run (local DB unreachable)

## Production Migration Status
- **NotificationDeliveryAttempt table**: Present in production Neon DB (applied via `scripts/ops/apply-notification-delivery-attempt-migration.mjs`)
- **Other migrations**: Assumed applied via Vercel build process + earlier manual migrations
- **Verification**: Deployed smoke tests ran after migration and did not report missing table errors

## Safest Production Migration Apply Path
1. Use `scripts/ops/apply-notification-delivery-attempt-migration.mjs` for ad-hoc table creation (uses Neon serverless driver)
2. Use `vercel env pull` + local `prisma migrate deploy` when local DB connectivity is available
3. Use Vercel build-time `prisma generate` for client generation
4. Never run `prisma migrate reset` on production
5. Never run destructive commands without explicit operator confirmation

## Warnings
- Local Neon pooler (`ep-little-river-aifwxtf7-pooler.c-4.us-east-1.aws.neon.tech:5432`) is unreachable from this Windows runner
- Production DB access should be through Neon dashboard SQL editor or serverless driver scripts only
- Some migrations may have been applied out-of-band; do not re-run without checking `information_schema`
