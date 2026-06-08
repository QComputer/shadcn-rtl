# Phase F — Driver Location Tracking API

## Actual source state

The implemented route is:

```txt
app/api/driver/location/route.ts
```

## Behavior

- `POST /api/driver/location`
  - Requires authenticated `DRIVER` role.
  - Accepts latitude, longitude, and optional accuracy.
  - Validates coordinate ranges.
  - Applies an in-memory per-driver update limit of one location update per 10 seconds.
  - Writes a `Location` row with `userId`, coordinates, optional accuracy, and null `organizationId`.

- `GET /api/driver/location`
  - Requires `ADMIN`, `MANAGER`, or `SUPER_ADMIN` role.
  - Supports optional `since` query parameter.
  - Reads recent location rows and returns the latest row per driver.

## Known limitations

- The rate limiter is in-memory and not multi-instance safe.
- `POST` stores `organizationId: null`; organization scoping should be revisited during tenant cleanup.
- `GET` is role-guarded, but it is not currently scoped to a specific organization membership.
- This phase is documented to close a missing README reference; deeper production hardening belongs in a later API normalization/tenant-scope phase.
