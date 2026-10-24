# RunFlare authentication compatibility

## Decision and scope (2026-10-24)

The original Vercel Production authentication secret is unavailable through authorized read paths. The owner authorized a new RunFlare-only cryptographically generated secret. It was entered into RunFlare project 36927 secret manager as `bazarbaaz-runtime-auth`, key `NEXTAUTH_SECRET`, and bound by reference to application 85798. Its value is not recorded here or in test artifacts. Vercel configuration remains unchanged.

## Actual dependencies

- `lib/auth.ts`: NextAuth JWT signing/encryption and authentication flow protection. Previously issued Vercel sessions will not authenticate on RunFlare after cutover. All users must sign in again; restart in-flight OAuth flows. Password hashes and organization memberships are unaffected.
- `lib/security/session-credential.server.ts`: credential-binding HMACs live inside JWT claims and are recomputed for server-side session validation. They are not stored-data encryption keys; old bindings must not be reused with the destination key.
- `lib/import-hub/retail-catalog.server.ts`: signed import-preview HMACs (15-minute validity). Regenerate outstanding previews after switching environments; do not execute stale previews.
- `lib/integrations/inoti-ussd/evidence.ts`: NEXTAUTH_SECRET fallback is development-only. Production requires its separate `INOTI_USSD_HASH_PEPPER`; preserve that key separately before enabling this integration, including continuity with already persisted evidence hashes.
- Payment correlation uses separate versioned `INOTI_PAYMENT_CORRELATION_KEY_V*` encryption keys. Preserve original keys before restoring/using encrypted integration data. The new authentication secret cannot replace them.
- No application stored-data decryption dependency on NEXTAUTH_SECRET was found in the source audit. Source Vercel sessions are not revoked by configuring a separate destination key.

This is a deliberate session discontinuity, not session continuity. Communicate reauthentication and signed-preview regeneration before final cutover. PRODUCTION_CUTOVER_READY remains NO until the cutover compatibility review is accepted.

## Configuration classification

| Class | Destination handling |
| --- | --- |
| Required application authentication | RunFlare-only NEXTAUTH_SECRET secure reference; AUTH_TRUST_HOST and destination HTTPS NEXTAUTH_URL |
| Target PostgreSQL | Explicit DATABASE_RUNTIME_ADAPTER=postgresql; PGHOST=database-giu-service, PGDATABASE=databasewhy_db, PGUSER=postgres; PGPASSWORD references the existing database service secret |
| Target storage | APPLICATION_STORAGE_ADAPTER=persistent-disk, MEDIA_STORAGE_ROOT=/disk/media |
| Build reproducibility | RUNFLARE_ENFORCE_LOCKFILE=1; Node 24; committed pnpm lockfile and pnpm 10.15.0 |
| Integration signing/encryption | Preserve independent original keys through secure configuration before the corresponding integration is enabled; never substitute NEXTAUTH_SECRET |
| Source-provider only | Do not copy Neon DATABASE_URL/DIRECT_URL, Vercel platform tokens, Blob write token or provider deployment metadata into the destination runtime |
| Optional external integrations | Configure only reviewed, required integrations with approved secure references; no blanket environment transfer or live-message/payment activation |

## Validation boundary

The destination database is intentionally empty in R6.2-A. Health SELECT 1 can prove connectivity; it cannot prove restored tenant data or successful merchant login. Actual destination account login requires R6.2-B schema/data availability and controlled test identities. Do not create application tables or restore Production data merely to pass this runtime phase.
