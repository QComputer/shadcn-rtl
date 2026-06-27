# Bazar Baz — Route, API, Database, and Service Inventory

_Last synchronized from the source tree: 2026-06-26._

This inventory is a planning aid for future phases. It reflects the current filesystem after Customer Club, campaign, loyalty/coupon, Web Push, public SEO, category slug/pagination, and public detail slug phases.

## 1. Localized page routes

All localized pages are under `app/[locale]`; supported locales are `fa`, `en`, and `ar`.

| Route |
| --- |
| /{locale}/appointment/{slug}/appointment/{id} |
| /{locale}/appointment/{slug}/booking |
| /{locale}/appointment/{slug}/fanpage |
| /{locale}/appointment/{slug}/my-appointments |
| /{locale}/appointment/{slug} |
| /{locale}/appointment/{slug}/services/category/{categoryIdOrSlug} |
| /{locale}/appointment/{slug}/services/{serviceIdOrSlug} |
| /{locale}/appointment/{slug}/services |
| /{locale}/appointment/{slug}/staff |
| /{locale}/dashboard/appointments/{id}/edit |
| /{locale}/dashboard/appointments/{id} |
| /{locale}/dashboard/appointments |
| /{locale}/dashboard/calendar |
| /{locale}/dashboard/customer-club/campaigns/{id} |
| /{locale}/dashboard/customer-club/campaigns/new |
| /{locale}/dashboard/customer-club/campaigns |
| /{locale}/dashboard/customer-club/coupons |
| /{locale}/dashboard/customer-club/loyalty |
| /{locale}/dashboard/customer-club/members |
| /{locale}/dashboard/customer-club/push |
| /{locale}/dashboard/customer-club/segments |
| /{locale}/dashboard/customer-club |
| /{locale}/dashboard/driver-orders |
| /{locale}/dashboard/members |
| /{locale}/dashboard/orders |
| /{locale}/dashboard/organizations/new |
| /{locale}/dashboard/organizations |
| /{locale}/dashboard |
| /{locale}/dashboard/product-categories |
| /{locale}/dashboard/products/{id} |
| /{locale}/dashboard/products/new |
| /{locale}/dashboard/products |
| /{locale}/dashboard/qrcode |
| /{locale}/dashboard/service-categories |
| /{locale}/dashboard/services/{id} |
| /{locale}/dashboard/services/new |
| /{locale}/dashboard/services |
| /{locale}/dashboard/settings/organization |
| /{locale}/dashboard/settings |
| /{locale}/dashboard/users |
| /{locale}/login |
| /{locale} |
| /{locale}/register/organization |
| /{locale}/register |
| /{locale}/shop/{slug}/checkout |
| /{locale}/shop/{slug}/category/{categoryIdOrSlug} |
| /{locale}/shop/{slug}/fanpage |
| /{locale}/shop/{slug}/order/{orderNumber} |
| /{locale}/shop/{slug} |
| /{locale}/shop/{slug}/product/{productIdOrSlug} |
| /{locale}/shop/{slug}/profile |

## 2. Route layouts

| Layout file | Scope |
| --- | --- |
| `app/[locale]/appointment/[slug]/layout.tsx` | `/{locale}/appointment/{slug}` |
| `app/[locale]/appointment/[slug]/appointment/[id]/layout.tsx` | `/{locale}/appointment/{slug}/appointment/{id}` |
| `app/[locale]/appointment/[slug]/booking/layout.tsx` | `/{locale}/appointment/{slug}/booking` |
| `app/[locale]/appointment/[slug]/my-appointments/layout.tsx` | `/{locale}/appointment/{slug}/my-appointments` |
| `app/[locale]/appointment/[slug]/services/[serviceId]/layout.tsx` | `/{locale}/appointment/{slug}/services/{serviceIdOrSlug}` |
| `app/[locale]/dashboard/layout.tsx` | `/{locale}/dashboard` |
| `app/[locale]/layout.tsx` | `/{locale}` |
| `app/[locale]/shop/[slug]/checkout/layout.tsx` | `/{locale}/shop/{slug}/checkout` |
| `app/[locale]/shop/[slug]/layout.tsx` | `/{locale}/shop/{slug}` |
| `app/[locale]/shop/[slug]/order/[orderNumber]/layout.tsx` | `/{locale}/shop/{slug}/order/{orderNumber}` |
| `app/[locale]/shop/[slug]/product/[productId]/layout.tsx` | `/{locale}/shop/{slug}/product/{productIdOrSlug}` |

## 3. API routes

| Route | Exported methods |
| --- | --- |
| /api/appointments/{id}/confirm | POST |
| /api/appointments/{id}/reschedule | PATCH |
| /api/appointments/{id} | GET, PATCH, DELETE |
| /api/appointments | GET, POST |
| /api/auth/{...nextauth} | NextAuth handlers |
| /api/auth/register/organization | POST |
| /api/auth/register | POST |
| /api/cart/items/{id} | PATCH, DELETE |
| /api/cart | GET, POST, DELETE |
| /api/conversations/{id}/messages | POST |
| /api/conversations/{id} | GET |
| /api/conversations | GET, POST |
| /api/customer/push-subscriptions | GET, POST, PATCH, DELETE |
| /api/customer/notifications | GET, PATCH |
| /api/customer-club/membership | GET, POST, PATCH, DELETE |
| /api/dashboard/customer-club/campaigns/{id}/send | POST |
| /api/dashboard/customer-club/campaigns/{id} | GET, PATCH, DELETE |
| /api/dashboard/customer-club/campaigns | GET, POST |
| /api/dashboard/customer-club/coupons | GET, POST |
| /api/dashboard/customer-club/loyalty | GET, POST |
| /api/dashboard/customer-club/members | GET |
| /api/dashboard/customer-club/push | GET, POST |
| /api/dashboard/customer-club/segments | GET, POST |
| /api/dashboard/notifications | GET, PATCH |
| /api/dashboard | GET |
| /api/driver/location | POST, GET |
| /api/health | GET |
| /api/images/{id} | DELETE |
| /api/images | GET |
| /api/orders/{id}/assign-driver | PUT |
| /api/orders/{id}/driver | POST, GET, PATCH, DELETE |
| /api/orders/{id}/payment | PUT |
| /api/orders/{id} | GET, PUT, PATCH, DELETE |
| /api/orders | GET, POST |
| /api/organizations/{id}/booking-settings | GET, PATCH |
| /api/organizations/{id}/business-hours | GET, PUT |
| /api/organizations/{id}/follow | POST, DELETE |
| /api/organizations/{id}/members/{mId} | GET, PUT |
| /api/organizations/{id}/members | GET, POST, PUT |
| /api/organizations/{id}/payment | GET, PUT |
| /api/organizations/{id} | PATCH, DELETE |
| /api/organizations/{id}/settings | GET, PUT |
| /api/organizations/open | GET, POST |
| /api/organizations | GET, POST |
| /api/product-categories/{id} | GET, PATCH, DELETE |
| /api/product-categories | GET, POST |
| /api/products/{id} | GET, PATCH, DELETE |
| /api/products/{id}/variants/{varId} | GET, PATCH, DELETE |
| /api/products/{id}/variants | GET, POST, PATCH |
| /api/products | GET, POST |
| /api/public/appointments/{id} | GET |
| /api/public/appointments/lookup | POST |
| /api/public/orders/{orderNumber} | GET, PUT |
| /api/public/organizations/{slug}/booking-settings | GET |
| /api/public/organizations/{slug}/fanpage/posts | GET, POST |
| /api/public/organizations/{slug} | GET |
| /api/public/organizations/{slug}/services/{serviceId} | GET |
| /api/public/organizations/{slug}/services | GET |
| /api/public/organizations/{slug}/shop | GET |
| /api/public/organizations/{slug}/staff | GET |
| /api/public/organizations | GET |
| /api/public/products/{id} | GET |
| /api/public/search | GET |
| /api/qrcode | GET, POST |
| /api/reviews/{id} | GET, PATCH, DELETE |
| /api/reviews | GET, POST |
| /api/service-categories/{id} | GET, PATCH, DELETE |
| /api/service-categories | GET, POST |
| /api/services/{id} | GET, PATCH, DELETE |
| /api/services/{id}/slots | GET |
| /api/services | GET, POST |
| /api/upload | POST |
| /api/users/{id} | GET, PUT, DELETE |
| /api/users/me/business-hours | GET, PUT |
| /api/users/me/membership | GET |
| /api/users/me | GET, PATCH, POST |
| /api/users | GET |
| /uploads/{filename} | GET |

## 4. Prisma enums

| Enum |
| --- |
| OrganizationType |
| UserRole |
| AppointmentStatus |
| CartStatus |
| OrderType |
| OrderStatus |
| DayOfWeek |
| PaymentStatus |
| PaymentMethod |
| InventoryMovementReason |
| AuditAction |
| ImageAccess |
| CustomerClubMembershipStatus |
| CustomerClubTier |
| CustomerClubJoinSource |
| CampaignStatus |
| CampaignChannel |
| CampaignDeliveryStatus |
| LoyaltyLedgerType |
| CouponDiscountType |
| PushPermissionState |

## 5. Prisma models

| Model |
| --- |
| TimeInterval |
| Organization |
| Deny |
| Notification |
| User |
| OrganizationMember |
| BusinessHour |
| PasswordReset |
| EmailVerification |
| ServiceCategory |
| Service |
| Appointment |
| StaffAvailability |
| BookingSession |
| ProductCategory |
| Image |
| Product |
| ProductVariant |
| ShopCart |
| ShopCartItem |
| GuestCustomer |
| Order |
| Progress |
| OrderItem |
| InventoryMovement |
| Payment |
| PaymentEvent |
| OrderStatusHistory |
| Promotion |
| Review |
| FanpagePost |
| Follow |
| CustomerClubMembership |
| CustomerSegment |
| CustomerSegmentRule |
| CustomerSegmentSnapshot |
| Campaign |
| CampaignAudience |
| CampaignMessage |
| CampaignDelivery |
| LoyaltyLedger |
| LoyaltyRule |
| Coupon |
| CouponRedemption |
| PushSubscription |
| NotificationPermissionEvent |
| Conversation |
| ConversationParticipant |
| Message |
| OrderMessage |
| Location |
| OrganizationSettings |
| PaymentSettings |
| BookingSettings |
| AuditLog |

## 6. Service modules

| File | Lines | Exports |
| --- | ---: | --- |
| `lib/services/appointment.service.ts` | 920 | AppointmentService, appointmentService |
| `lib/services/audit.service.ts` | 200 | AuditAction, CreateAuditLogInput, AuditService, auditService, logEntityChange |
| `lib/services/booking-settings.service.ts` | 146 | BookingSettingsInput, BookingSettingsService, bookingSettingsService |
| `lib/services/cart.service.ts` | 538 | CartService, cartService |
| `lib/services/category.service.ts` | 384 | ProductCategoryService, ServiceCategoryService, productCategoryService, serviceCategoryService |
| `lib/services/campaign-builder.service.ts` | 556 | CampaignBuilderService, campaignBuilderService |
| `lib/services/customer-club.service.ts` | 183 | CustomerClubService, customerClubService |
| `lib/services/customer-segments.service.ts` | 306 | CUSTOMER_SEGMENT_DEFINITIONS, CustomerSegmentsService, customerSegmentsService |
| `lib/services/fanpage.service.ts` | 111 | FanpageService, fanpageService |
| `lib/services/follow.service.ts` | 201 | FollowService, followService |
| `lib/services/loyalty-coupons.service.ts` | 636 | LoyaltyCouponsService, loyaltyCouponsService |
| `lib/services/messaging.service.ts` | 317 | MessagingService, messagingService |
| `lib/services/notification.service.ts` | 231 | NotificationPayload, AppointmentNotificationData, NotificationService, notificationService |
| `lib/services/order.service.ts` | 1626 | OrderService, orderService |
| `lib/services/organization.service.ts` | 651 | OrganizationService, organizationService |
| `lib/services/product.service.ts` | 458 | ProductService, productService |
| `lib/services/review.service.ts` | 278 | CreateReviewData, UpdateReviewData, ReviewService, reviewService |
| `lib/services/service.service.ts` | 534 | ServiceService, serviceService |
| `lib/services/user.service.ts` | 149 | UserService, userService |
| `lib/services/web-push-foundation.service.ts` | 399 | getWebPushRuntimeConfig, WebPushFoundationService, webPushFoundationService |

## 7. Current interpretation notes

- Public fanpage surfaces now exist for both appointment organizations and shop organizations: `/{locale}/appointment/{slug}/fanpage` and `/{locale}/shop/{slug}/fanpage`.
- The fanpage post API is slug-based and lives at `/api/public/organizations/{slug}/fanpage/posts`; `GET` is public and `POST` requires an authorized organization `ADMIN` or `MANAGER` session.
- Driver location support exists through `/api/driver/location` and dashboard driver-order surfaces.
- `dashboard/notifications` separates read and mutation behavior: `GET` lists notifications and `PATCH` marks notifications seen/read.
- Customer Club growth surfaces now include members, segments, campaign builder, loyalty/coupons, and Web Push opt-in foundation routes.
- Web Push real delivery is not active by default; P47 stores opt-in state and supports dry-run recipient previews only.
- The route inventory intentionally records actual files. It is not a promise that every page is fully production-polished.
- Future guard/authorization cleanup should continue to prefer shared service/API guard helpers over ad hoc route-level Prisma access.
