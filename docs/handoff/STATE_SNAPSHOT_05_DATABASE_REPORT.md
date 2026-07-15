# Bazar Baz Handoff Snapshot 05 - Database Report

## Schema Overview

Prisma datasource: PostgreSQL via `env("DATABASE_URL")`.

Current schema inventory:

| Item | Count |
| --- | ---: |
| Models | 71 |
| Enums | 42 |
| Migrations entries | 48 timestamped migration folders plus `migration_lock.toml` |

Secret values are not printed in this report.

## Important Entities

| Domain | Key Models |
| --- | --- |
| Tenancy | `Organization`, `OrganizationMember`, `OrganizationSettings`, `BusinessHour`, `PaymentSettings`, `BookingSettings` |
| Users/roles | `User`, `OrganizationMember`, `Deny`, role enum `UserRole` |
| Products/shop | `Product`, `ProductVariant`, `ProductCategory`, `Image`, `InventoryMovement` |
| Cart/orders | `ShopCart`, `ShopCartItem`, `GuestCustomer`, `Order`, `OrderItem`, `Payment`, `PaymentEvent`, `OrderStatusHistory`, `Progress` |
| Appointments | `Service`, `ServiceCategory`, `Appointment`, `StaffAvailability`, `BookingSession` |
| Customer club | `CustomerClubMembership`, `CustomerSegment`, `CustomerSegmentRule`, `CustomerSegmentSnapshot`, `Campaign`, `CampaignAudience`, `CampaignMessage`, `CampaignDelivery`, `LoyaltyLedger`, `LoyaltyRule`, `Coupon`, `CouponRedemption` |
| Notifications | `Notification`, `NotificationPreference`, `NotificationDeliveryAttempt` |
| Web Push | `PushSubscription`, `NotificationPermissionEvent`, `WebPushDelivery` |
| SMS | `SmsDelivery` |
| Messaging | `Conversation`, `ConversationParticipant`, `Message`, `OrderMessage` |
| Imports/exports | `ExternalImportSource`, `ExternalImportJob`, `ImportedProductDraft`, `ImportedContentDraft`, `ExportJob` |
| AI/Creative | `AiMediaJob`, `AiMediaUsageEvent`, `CreativeStudioJob`, `CreativeStudioAsset`, `CreativeStudioUsageEvent` |
| B2B leads | `RequestDemoLead` |
| Custom domains | `OrganizationDomain` |
| Audit | `AuditLog` |

## Organization Tenancy Model

`Organization` is the central tenant. It has type `SHOP` or `APPOINTMENT`, a slug, locale, active/deleted status, settings, members, products/services/orders/appointments, customer club records, notifications, SMS/Web Push records, imports/exports, request-domain mappings, and audit logs.

`OrganizationMember` links users to organizations with organization-scoped roles. Global `User.role` still exists for SUPER_ADMIN and broad role behavior; route guards combine global role, current organization, and membership.

## RequestDemoLead

`RequestDemoLead` stores public B2B lead submissions. The public API validates consent and phone format, normalizes phone, rate-limits submission, does not create users or tenants, and does not send SMS. SUPER_ADMIN dashboard review can update status and record audit context.

## OrganizationDomain

`OrganizationDomain` stores normalized tenant custom domains:

- Global unique `normalizedDomain`.
- Lifecycle statuses such as `REQUESTED`, `PROVIDER_PENDING`, `DNS_REQUIRED`, `VERIFYING`, `ACTIVE`, `ERROR`, `DISABLED`, `REMOVAL_PENDING`, and `REMOVED`.
- Domain kind `APEX` or `SUBDOMAIN`.
- Provider metadata for Vercel.
- DNS/SSL/verification fields.
- Primary domain flag.
- Soft-delete/review/audit user fields.

P11 source acceptance is complete. Production migration status remains pending unless an operator separately confirms it has been applied.

## Migration Status

Important recent migrations:

| Migration | Purpose |
| --- | --- |
| `20260703000200_notification_delivery_attempt` | Notification delivery attempt telemetry |
| `20260703000300_sms_delivery_guest_customer` | Guest SMS delivery support |
| `20260707000100_request_demo_lead_storage` | P10 request-demo lead storage |
| `20260707000200_export_hub_extend_data_types` | Export Hub extension |
| `20260708000100_custom_domain_onboarding` | P11 custom-domain onboarding |

Production migration status:

- NotificationDeliveryAttempt was previously documented as applied via Neon serverless in earlier handoff docs.
- P10 request-demo lead migration was accepted in prior phase docs.
- P11 custom-domain onboarding migration is required; this handoff did not apply it.

