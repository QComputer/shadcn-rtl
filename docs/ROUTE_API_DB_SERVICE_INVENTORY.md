# Bazar Baz — Route, API, Database, and Service Inventory

_Last generated from source tree: 2026-06-02._

This document records the current application inventory so future work can be planned against the actual filesystem rather than stale assumptions.

## 1. Localized page routes

| Route |
| --- |
| /{locale}/dashboard/appointments/{id}/edit |
| /{locale}/dashboard/appointments/{id} |
| /{locale}/dashboard/appointments |
| /{locale}/dashboard/calendar |
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
| /{locale}/organizations/{slug}/appointment/{id} |
| /{locale}/organizations/{slug}/booking |
| /{locale}/organizations/{slug}/my-appointments |
| /{locale}/organizations/{slug} |
| /{locale}/organizations/{slug}/services/{serviceId} |
| /{locale}/organizations/{slug}/services |
| /{locale}/organizations/{slug}/staff |
| /{locale} |
| /{locale}/register/organization |
| /{locale}/register |
| /{locale}/shop/{slug}/checkout |
| /{locale}/shop/{slug}/order/{orderNumber} |
| /{locale}/shop/{slug} |
| /{locale}/shop/{slug}/product/{productId} |

## 2. API routes

| Route | Exported methods |
| --- | --- |
| /app/api/appointments/{id}/confirm | POST |
| /app/api/appointments/{id} | GET, PATCH, DELETE |
| /app/api/appointments | GET, POST |
| /app/api/auth/{...nextauth} | NextAuth handlers |
| /app/api/auth/register/organization | POST |
| /app/api/auth/register | POST |
| /app/api/cart/items/{id} | PATCH, DELETE |
| /app/api/cart | GET, POST, DELETE |
| /app/api/conversations/{id}/messages | POST |
| /app/api/conversations/{id} | GET |
| /app/api/conversations | GET, POST |
| /app/api/dashboard/notifications | GET |
| /app/api/dashboard | GET |
| /app/api/health | GET |
| /app/api/images/{id} | DELETE |
| /app/api/images | GET |
| /app/api/orders/{id}/driver | POST, GET, DELETE, PATCH |
| /app/api/orders/{id}/payment | PUT |
| /app/api/orders/{id} | GET, PUT, PATCH, DELETE |
| /app/api/orders | GET, POST |
| /app/api/organizations/{id}/booking-settings | GET, PATCH |
| /app/api/organizations/{id}/business-hours | GET, PUT |
| /app/api/organizations/{id}/follow | POST, DELETE |
| /app/api/organizations/{id}/members/{mId} | GET, PUT |
| /app/api/organizations/{id}/members | GET, POST, PUT |
| /app/api/organizations/{id}/payment | GET, PUT |
| /app/api/organizations/{id} | PATCH, DELETE |
| /app/api/organizations/{id}/settings | GET, PUT |
| /app/api/organizations/open | GET, POST |
| /app/api/organizations | GET, POST |
| /app/api/product-categories/{id} | GET, PATCH, DELETE |
| /app/api/product-categories | GET, POST |
| /app/api/products/{id} | GET, PATCH, DELETE |
| /app/api/products/{id}/variants/{varId} | GET, PATCH, DELETE |
| /app/api/products/{id}/variants | GET, POST, PATCH |
| /app/api/products | GET, POST |
| /app/api/public/appointments/{id} | GET |
| /app/api/public/appointments/lookup | POST |
| /app/api/public/orders/{orderNumber} | GET, PUT |
| /app/api/public/organizations/{slug}/booking-settings | GET |
| /app/api/public/organizations/{slug} | GET |
| /app/api/public/organizations/{slug}/services/{serviceId} | GET |
| /app/api/public/organizations/{slug}/services | GET |
| /app/api/public/organizations/{slug}/shop | GET |
| /app/api/public/organizations/{slug}/staff | GET |
| /app/api/public/organizations | GET |
| /app/api/public/products/{id} | GET |
| /app/api/public/search | GET |
| /app/api/qrcode | GET, POST |
| /app/api/reviews/{id} | GET, PATCH, DELETE |
| /app/api/reviews | GET, POST |
| /app/api/service-categories/{id} | GET, PATCH, DELETE |
| /app/api/service-categories | GET, POST |
| /app/api/services/{id} | GET, PATCH, DELETE |
| /app/api/services/{id}/slots | GET |
| /app/api/services | GET, POST |
| /app/api/upload | POST |
| /app/api/users/{id} | GET, PUT, DELETE |
| /app/api/users/me/business-hours | GET, PUT |
| /app/api/users/me/membership | GET |
| /app/api/users/me | GET, PATCH, POST |
| /app/api/users | GET |

## 3. Prisma enums

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

## 4. Prisma models

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
| Follow |
| Conversation |
| ConversationParticipant |
| Message |
| OrderMessage |
| Location |
| OrganizationSettings |
| PaymentSettings |
| BookingSettings |
| AuditLog |

## 5. Service modules

| File | Lines | Exports |
| --- | --- | --- |
| lib/services/appointment.service.ts | 734 | AppointmentService, appointmentService |
| lib/services/audit.service.ts | 200 | AuditService, auditService, logEntityChange |
| lib/services/booking-settings.service.ts | 146 | BookingSettingsService, bookingSettingsService |
| lib/services/cart.service.ts | 501 | CartService, cartService |
| lib/services/category.service.ts | 384 | ProductCategoryService, ServiceCategoryService, productCategoryService, serviceCategoryService |
| lib/services/follow.service.ts | 195 | FollowService, followService |
| lib/services/messaging.service.ts | 317 | MessagingService, messagingService |
| lib/services/notification.service.ts | 223 | NotificationService, notificationService |
| lib/services/order.service.ts | 1501 | OrderService, orderService |
| lib/services/organization.service.ts | 642 | OrganizationService, organizationService |
| lib/services/product.service.ts | 441 | ProductService, productService |
| lib/services/review.service.ts | 278 | ReviewService, reviewService |
| lib/services/service.service.ts | 534 | ServiceService, serviceService |
| lib/services/user.service.ts | 149 | UserService, userService |

## 6. Important support modules

| File | Responsibility |
| --- | --- |
| `lib/auth.ts` | NextAuth configuration, credentials provider, optional Google provider, account lockout behavior. |
| `lib/api-guards.ts` | Shared API auth/RBAC/resource guard helpers and API error wrapper. |
| `lib/access-control.ts` | Client-side dashboard nav and route access registry. Requires cleanup against actual routes. |
| `lib/db.ts` | Prisma client creation and soft-delete helper metadata. |
| `lib/dictionary.ts` | Dictionary loading and key lookup helper. |
| `lib/i18n.ts` / `lib/i18n-routing.ts` | Supported locale and route helpers. |
| `lib/rate-limit.ts` | In-memory rate limiting helper; acceptable for dev/single instance only. |
| `lib/media-storage.ts` | Upload storage helper functions. |
| `lib/runtime-env.ts` | Safe runtime environment validation/health metadata. |
| `hooks/use-auth.tsx` | Client auth context, sign in/out helpers, dashboard access hook. Needs cleanup. |
| `hooks/use-theme.tsx` | Client theme provider/hook. |
| `hooks/useWebRTC.ts` | WebRTC hook support. |
| `context/SocketContext.tsx` | Socket provider context. |
| `components/providers.tsx` | Root client providers. Currently duplicates `SessionProvider`. |
| `components/dashboard/dashboard-sidebar.tsx` | Dashboard navigation filtered by access-control context. |
| `components/dashboard/appointment-full-calendar.tsx` | FullCalendar dashboard appointment surface. |

## 7. Inventory interpretation notes

- The actual dashboard page list is broader than the explicit `lib/access-control.ts` route registry.
- The stale route registry contains paths that do not exist and misses several actual dashboard pages.
- API route handlers use a mixture of shared guards, manual `auth()` checks, raw Prisma calls, manual validation, and some Zod validation.
- Service files are substantial; future refactors should preserve service-layer boundaries rather than pushing business logic back into pages.
- The Prisma schema is rich enough to support real workflows, but identity normalization should be addressed before more cross-tenant features are added.
