# Phase E — Admin Order Page Enhancements (Handoff)

## Summary
Added driver assignment capabilities to the admin orders dashboard and improved order visibility.

## Files Created
| File | Purpose |
|------|---------|
| `app/api/orders/[id]/assign-driver/route.ts` | New API endpoint for assigning/reassigning drivers to orders. Accepts `{ driverId: string }` in the request body. |

## Files Modified
| File | Change |
|------|--------|
| `app/[locale]/dashboard/orders/page.tsx` | Added driver assignment state, `fetchDrivers()` to load DRIVER users, `assignDriver()` function, and a driver assignment dropdown in the order detail dialog. Added driver badges to order cards showing assigned driver name or "بدون پیک" (no driver). Added driver filter dropdown in the filters bar. |
| `package.json` | Fixed missing comma after `@types/leaflet` dependency (syntax error from Phase C). |

## New Features
1. **Assign Driver Button**: In the order detail dialog, admins can select a driver from a dropdown to assign/reassign. Shows current driver and allows removal.
2. **Driver Badges**: Order cards now show the assigned driver's name or "بدون پیک" if unassigned.
3. **Driver Filter**: Filter orders by specific driver or show unassigned orders only.

## API Details
- **Endpoint**: `PUT /api/orders/[id]/assign-driver`
- **Auth**: Requires ADMIN, MANAGER, or SUPER_ADMIN role + order access
- **Body**: `{ driverId: string }` (pass empty string `""` to remove assignment)
- **Response**: Returns the updated order object

## Important Notes
1. The driver list is fetched from `/api/users` with `role=DRIVER` filter. Ensure DRIVER users exist in the system.
2. The `assignDriver` function uses the existing `orderService.assignDriver()` which already validates permissions.
3. Driver assignment is immediate; the order list refreshes automatically after assignment.
4. **No port 3000 changes** — development server configuration unchanged.

## Remaining Items
- Phase F (Location Tracking API) is optional and can be deferred.
- Consider adding driver capacity limits (max orders per driver).
- Add notifications when a driver is assigned to an order.
