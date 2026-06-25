# Seed Data & Role-Based Access Testing Guide

Date: 2026-06-25

This guide reflects the active seed file in this source tree: `prisma/seed.ts`.

## Safety warning

The seed script is destructive for demo-domain data. It deletes existing messages, conversations, follows, reviews, payments, orders, carts, appointments, catalog data, settings, locations, organizations, and users before recreating demo data.

Do not run it against a production database.

## Prerequisites

- Dependencies installed with `pnpm install`.
- `DATABASE_URL` points to a disposable local/demo database.
- Prisma client can be generated against the current schema.

Recommended preflight:

```powershell
pnpm run db:validate
pnpm run db:generate
```

## Run the seed

The active package script is:

```powershell
pnpm run db:seed
```

Equivalent direct command:

```powershell
pnpm exec tsx prisma/seed.ts
```

## Effective demo password

The current seed hashes this password for seeded users:

```txt
123456
```

Older documentation and the seed console footer may mention `password123`; that is stale and should be fixed in the next code cleanup phase.

## Core seeded usernames

Login supports username, email, or phone depending on the account fields. Username is the safest reference for seeded accounts because several demo users intentionally omit email.

| Purpose | Username | Role | Notes |
| --- | --- | --- | --- |
| System admin | `superadmin` | `SUPER_ADMIN` | Full platform access. |
| Shop admin | `shop-admin` | `ADMIN` | Admin member for a shop organization. |
| Shop manager | `shop-manager` | `MANAGER` | Manager member for a shop organization. |
| Shop staff | `shop-staff` | `STAFF` | Limited shop staff account. |
| Shop driver | `shop-driver` | `DRIVER` | Driver workflow account. |
| Appointment admin | `fariba` | `ADMIN` | Appointment organization admin. |
| Appointment manager | `simin` | `MANAGER` | Appointment organization manager. |
| Appointment staff | `negar` | `STAFF` | Appointment staff/provider account. |
| Appointment staff/provider | `tahere` | `STAFF` | Appointment provider account. |
| Appointment staff/provider | `narges` | `STAFF` | Appointment provider account. |
| Customer | `eli` | `CUSTOMER` | Customer order/appointment workflows. |
| Customer | `customer2` | `CUSTOMER` | Customer order/appointment workflows. |
| Customer without email | `customer3` | `CUSTOMER` | Username/phone login path. |
| Driver | `driver1` | `DRIVER` | Driver workflow account. |
| Driver without email | `driver2` | `DRIVER` | Username/phone login path. |
| Legal admin | `law-admin` | `ADMIN` | Appointment/legal organization account. |
| Legal manager | `law-manager` | `MANAGER` | Appointment/legal organization account. |
| Legal staff | `law-staff` | `STAFF` | Appointment/legal organization account. |
| Senior lawyer | `lawyer-senior` | `STAFF` | Service-provider style legal account. |
| Junior lawyer | `lawyer-junior` | `STAFF` | Service-provider style legal account. |
| Dental admin | `denital-admin` | `ADMIN` | Current seed spelling is `denital-*`. |
| Dental manager | `denital-manager` | `MANAGER` | Current seed spelling is `denital-*`. |
| Dental staff | `denital-staff` | `STAFF` | Current seed spelling is `denital-*`. |
| Dental senior | `denital-senior` | `STAFF` | Current seed spelling is `denital-*`. |
| Dental junior | `denital-junior` | `STAFF` | Current seed spelling is `denital-*`. |
| Additional shop admin | `hosein` | `ADMIN` | Additional shop organization account. |
| Additional shop manager | `manager1` | `MANAGER` | Additional shop organization account. |
| Additional shop staff | `sstaff1` | `STAFF` | Additional shop organization account. |
| Additional driver | `driver0` | `DRIVER` | Additional driver account. |
| Additional shop admin | `amir` | `ADMIN` | Additional shop organization account. |
| Additional shop manager | `chakme1` | `MANAGER` | Additional shop organization account. |
| Additional shop staff | `chakme2` | `STAFF` | Additional shop organization account. |
| Additional driver | `chakme3` | `DRIVER` | Additional driver account. |

## Seeded organization slugs

| Slug | Type | Name |
| --- | --- | --- |
| `salamat-shop` | `SHOP` | فروشگاه اینترنتی سلامت |
| `khoone-food` | `SHOP` | سفارش غذای خونه |
| `sicily` | `SHOP` | رستوران سیسیلی |
| `chakme` | `SHOP` | کافه رستوران چکمه |
| `tikal` | `APPOINTMENT` | کلینیک زیبایی تی کال |
| `dental-smile` | `APPOINTMENT` | دندانپزشکی لبخند |
| `spa-aramesh` | `APPOINTMENT` | اسپا آرامش |
| `law-justice` | `APPOINTMENT` | دفتر وکالت عدالت |

## Basic local UI smoke checks

Start the app after seeding:

```powershell
pnpm run dev
```

Then verify:

| Workflow | URL pattern | Suggested account |
| --- | --- | --- |
| Home/search | `http://localhost:3000/fa` | anonymous |
| Login | `http://localhost:3000/fa/login` | any seeded user |
| Dashboard | `http://localhost:3000/fa/dashboard` | `superadmin`, `shop-admin`, `fariba` |
| Shop page | `http://localhost:3000/fa/shop/sicily` | anonymous/customer |
| Shop fanpage | `http://localhost:3000/fa/shop/sicily/fanpage` | anonymous/admin |
| Appointment page | `http://localhost:3000/fa/appointment/tikal` | anonymous/customer |
| Appointment fanpage | `http://localhost:3000/fa/appointment/tikal/fanpage` | anonymous/admin |
| Booking | `http://localhost:3000/fa/appointment/tikal/booking` | customer |
| Driver orders | `http://localhost:3000/fa/dashboard/driver-orders` | driver/admin depending on workflow |

## API smoke checks

Use browser/devtools, PowerShell `Invoke-WebRequest`, or another HTTP client.

Public reads:

```powershell
Invoke-WebRequest http://localhost:3000/api/health
Invoke-WebRequest http://localhost:3000/api/public/search
Invoke-WebRequest http://localhost:3000/api/public/organizations/sicily/shop
Invoke-WebRequest http://localhost:3000/api/public/organizations/sicily/fanpage/posts
Invoke-WebRequest http://localhost:3000/api/public/organizations/tikal/services
```

Protected/dashboard APIs require a browser session or authenticated HTTP client. Prefer UI-based checks unless a phase explicitly adds API test helpers.

## Role expectations

| Role | Expected access |
| --- | --- |
| `SUPER_ADMIN` | Platform-wide dashboard and management access. |
| `ADMIN` | Organization administration for memberships they own/administer. |
| `MANAGER` | Organization operational management within assigned orgs. |
| `STAFF` | Limited dashboard/provider/staff workflows depending on org membership. |
| `DRIVER` | Driver orders/location workflows. |
| `CUSTOMER` | Public browsing, order/appointment ownership workflows; no dashboard admin access. |
| `GUEST` | Schema role exists; public anonymous flows mostly use unauthenticated/guest customer data. |

## Validation after seeding

```powershell
pnpm run db:validate
pnpm run typecheck
pnpm run build
pnpm run quality:local
```

## Known seed cleanup debt

- Fix the seed console footer so it prints the effective password `123456` instead of stale `password123` text.
- Consider renaming `denital-*` usernames to `dental-*` only if a migration/seed reset can tolerate changed demo credentials.
- Add a focused seed-auth smoke script if future phases rely heavily on deterministic demo users.
