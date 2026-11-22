# Hotel Damoon completion checklist — 2026-11-22

This checklist records repository implementation and known launch inputs. A feature in code is not evidence of Production content, domain, payment, or booking acceptance.

| Area | Implemented in repository | Missing or defective | Criticality | Dependency | Delivery batch |
|---|---|---|---|---|---|
| Public landing and responsive design | Dedicated Damoon site, Persian-first RTL, responsive pages and browser harness | Current public-domain/browser acceptance is not recorded in this checkout | REQUIRED | Reviewed release and public-domain acceptance | B4 |
| Branding and themes | Independent Damoon theme tokens, palette controls and approved layout references | Owner-approved logo package and current brand assets are not recorded | BLOCKER | Owner supplies/approves identity assets | B2 |
| Room catalog and details | Room/accommodation pages and published category contracts | Only approved aggregate counts and broad categories may be shown; per-category facts and images need owner confirmation | REQUIRED | Owner confirms room facts and media | B2 |
| Inventory and availability | Manager operations can configure physical rooms and nightly inventory; the dated room board now includes maintenance blocks | Damoon production counts are zero in the recorded preflight; room data and migration lineage still block Production inventory | BLOCKER | Verified room data; migration-lineage gate; staged acceptance | B1, B3 |
| Pricing and rates | Rate plans, nightly rates and cancellation policy management exist | No owner-approved rates or cancellation policy values are recorded | BLOCKER | Owner-approved values and staged verification | B2, B3 |
| Guest stay requests | Public request flow and reception request workflow are implemented; reception is functionally closed for this release | No new reception request work is planned absent a critical defect | IMPLEMENTED | Existing 15/15 PostgreSQL browser acceptance | Closed |
| Management and hotel operations | CMS and manager operations for rooms, rates, inventory, lifecycle, dated maintenance and the room board exist; staff-only manual walk-in/reception reservation creation now uses the shared inventory claim and room assignment lifecycle without public booking/payment flags | Manual entry currently requires an active rate plan and cancellation policy; staff cannot enter an unpriced amount or change guest/date details after creation. This is a remaining workflow limitation, not a completed full manual-entry outcome | REQUIRED | Owner-approved active rates and cancellation policy; PostgreSQL/browser acceptance; follow-up for explicit unpriced/manual edits | B1 |
| Website content management | Draft, preview, review, publication, revocation and media association flows exist | Real owner-approved copy and publication decision remain inputs | REQUIRED | Owner content approval | B2 |
| Galleries, media and VTour | Gallery/media contracts and a Damoon frontend are present | Approved current photography and accepted canonical VTour playback/domain rights are not established | BLOCKER | Owner media/rights and VTour destination approval | B2 |
| Persian, English and Arabic | All three locale paths and translations exist | Owner review of English/Arabic hotel facts is not evidenced | REQUIRED | Owner/translator review | B2 |
| Customer accounts | Guest entry and request coordination exist; reservation APIs are gated | Account reservation history and self-service operational booking are not launch-ready/accepted | OPTIONAL | Booking/identity gates and approved policy | B3 |
| SEO, metadata, PWA and custom domain | Metadata, manifest and custom-host routing support exist; noindex is deliberate | Keep noindex until content approval; live custom-domain, install and SEO acceptance are not evidenced here | BLOCKER | Approved content and reviewed release; explicit indexing decision | B4 |
| Policies, contacts and essential navigation | Main content routes and navigation are implemented | Final owner-approved stay/privacy policies and contact fact review are needed | REQUIRED | Owner approval | B2 |
| Security and Production readiness | Tenant-scoped management authorization and fail-closed website/booking gates exist | Recorded Production migration-lineage mismatch blocks migration; public booking/payment remain gated | BLOCKER | Approved lineage resolution and isolated/staged evidence | B3 |

## Active implementation batch

- [x] Add a manager-only, read-only daily room board to Hotel Operations using the existing tenant/property-scoped room-night allocations.
- [x] Surface confirmed reservations without physical assignments instead of presenting those nights as room occupancy.
- [x] Keep the existing out-of-service flag visible and state that it is not a dated maintenance calendar.
- [x] Focused room-board tests pass 2/2; scoped ESLint passes.
- [x] Full repository TypeScript passes in the clean PR worktree.
- [x] Extend the disposable PostgreSQL operations test for assigned and unassigned room nights, with no guest or payment data in the board.
- [x] Add manager-only dated maintenance blocks with create/release actor history, idempotent create, range validation and reservation overlap checks.
- [x] Enforce maintenance/assignment exclusion in PostgreSQL so racing room assignments cannot overlap a scheduled block.
- [x] Show active dated maintenance in the room board and add fa/en/ar management controls behind `HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED` (default off).
- [x] Add manual reception walk-in/phone entry with explicit physical room, source/history, server-priced active rate snapshot, and a confirmed but unpaid status; keep it behind `HOTEL_MANUAL_ROOM_MANAGEMENT_ENABLED` and independent of public booking/payment gates.
- [x] Reuse shared room-type inventory claims for manual entry; test same-room contention, maintenance conflicts, tenant denial, replay, cancellation, check-in and check-out in the disposable PostgreSQL acceptance suite.
- [ ] Manual rate-free/owner-entered price snapshots and post-create guest/date edits remain outside this batch; the service currently requires an active rate plan and cancellation policy.
- [ ] Run hosted PostgreSQL/browser CI for manual reception entry before release.

The room board remains read-only. The maintenance mutation gate is off by default and does not activate online booking, payment, automatic allocation, room data, rates, or Production gates.
