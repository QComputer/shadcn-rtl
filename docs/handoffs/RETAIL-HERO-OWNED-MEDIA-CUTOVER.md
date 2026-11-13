# Retail Hero owned-media cutover

## Source policy

Retail Website Studio exposes only PUBLIC `Image` rows owned by the active organization. The Hero editor accepts selection from that gallery or direct upload into it. Static tenant homepage assets are never gallery entries. Image access (`PUBLIC`) is a delivery/security flag, not an approval workflow.

## Existing publication transition

- A published revision whose Hero IDs use the legacy `brand:<slug>:<static-url>` form is reported in Website Studio as requiring owner replacement. A read-only compatibility resolver serves those exact static assets only while that legacy revision remains the published pointer.
- Saving, previewing, publishing, and rolling back use the current organization’s PUBLIC image rows. Legacy IDs and unavailable, private, deleted, or foreign images fail write validation. A rejected replacement or rollback leaves the current publication pointer unchanged.
- The owner selects or uploads replacement media, saves a revision, checks the private preview, and explicitly publishes it. That publication is the cutover: public resolution uses the owned media reference, and legacy static media is no longer included for that pointer.
- No revision or media record is rewritten or deleted. No static image is copied into the media gallery. No database migration is required.

## How to classify current Retail surfaces

Use a read-only inventory before release; do not infer production data from source files alone.

1. **Managed Hero with owned media:** follow `OrganizationSettings.settings.retailHeroPublication.revisionId` to a `TenantWebsiteRevision` for the same organization; check its four Hero image IDs against PUBLIC `Image` rows with the same `organizationId` and eligible URL.
2. **Managed Hero with legacy static media:** the published revision has one or more `brand:` Hero IDs. It remains visible under the compatibility rule above until an owner publishes its replacement.
3. **No managed Hero pointer:** the Retail catalog no longer renders the automatic `RetailStorefrontHero` fallback. It proceeds directly to categories and products; no unrelated banner is selected.
4. **Editorial organization homepage:** static homepage assets resolved by `lib/organization-home-content.ts` remain separate. This change does not delete or alter those assets or other tenant branding.

The repository does not establish which of these states is currently active for each Production organization. Complete the read-only production inventory and owner replacement scheduling as a release operation; do not modify Production data as part of this PR.
