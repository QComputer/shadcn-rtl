# Request Demo Admin Review Workflow

## Overview

SUPER_ADMIN users manage request-demo leads through a dedicated dashboard page at:

```
/{locale}/dashboard/request-demo-leads
```

## Access Control

- Only users with global `SUPER_ADMIN` role can access this page.
- Tenant admins (organization-level ADMIN/MANAGER) are blocked.
- Unauthenticated users are redirected to login.

## Lead List

The list view shows:
- `createdAt` — Jalali date
- `businessName` — masked phone by default (last 4 digits visible)
- `fullName`
- `businessType`
- `city`
- `status` — color-coded badge
- `preferredContactTime` (not shown in table, visible in detail)

## Lead Detail and Update

From the detail dialog, SUPER_ADMIN can:
1. Change the lead status (NEW → REVIEWED → CONTACTED → QUALIFIED / REJECTED / ARCHIVED).
2. Add or update an admin note (internal, max 2000 characters).
3. Save changes via the PATCH API.

The system automatically records:
- `reviewedAt` — timestamp of the last status change.
- `reviewedById` — the SUPER_ADMIN who made the change.

## Audit Logging

Every status change is written to the `AuditLog` table with:
- `action: UPDATE`
- `entityType: RequestDemoLead`
- `entityId: <lead-id>`
- `previousValue` and `newValue` containing status and admin note.
- `userId`, `ipAddress`, `userAgent` from the request context.

## API Endpoints

### GET /api/dashboard/request-demo-leads

List leads with pagination and optional status filter.

**Query params:**
- `page` — page number (default 1)
- `limit` — items per page, max 100 (default 20)
- `status` — optional enum filter

**Response:**
```json
{
  "items": [...],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

Phone numbers are masked in the response (`******5678`).

### PATCH /api/dashboard/request-demo-leads/{id}

Update a single lead.

**Request body:**
```json
{
  "status": "CONTACTED",
  "adminNote": "Called the business owner, interested in shop plan."
}
```

**Response:** Full lead object (phone masked in list but visible in detail view response for SUPER_ADMIN).

## No Side Effects

- No SMS is triggered by任何一个 status change.
- No email is triggered by any action.
- No tenant is created.
- No public data is mutated.
