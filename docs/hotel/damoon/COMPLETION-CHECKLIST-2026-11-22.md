# Hotel Damoon completion checklist — 2026-11-22

This checklist records repository implementation and known launch inputs. A feature in code is not evidence of Production content, domain, payment, or booking acceptance.

| Area | Implemented in repository | Missing or defective | Criticality | Dependency | Delivery batch |
|---|---|---|---|---|---|
| Public landing and responsive design | Dedicated Damoon site, Persian-first RTL, responsive pages and browser harness | Current public-domain/browser acceptance is not recorded in this checkout | REQUIRED | Reviewed release and public-domain acceptance | B4 |
| Branding and themes | Independent Damoon theme tokens, palette controls and approved layout references | Owner-approved logo package and current brand assets are not recorded | BLOCKER | Owner supplies/approves identity assets | B2 |
| Room catalog and details | Room/accommodation pages and published category contracts | Only approved aggregate counts and broad categories may be shown; per-category facts and images need owner confirmation | REQUIRED | Owner confirms room facts and media | B2 |
| Inventory and availability | Manager operations can configure physical rooms and nightly inventory; guest preview is read-only | Damoon production counts are zero in the recorded preflight; no dated physical-room board previously existed | BLOCKER | Verified room data; migration-lineage gate; staged acceptance | B1, B3 |
| Pricing and rates | Rate plans, nightly rates and cancellation policy management exist | No owner-approved rates or cancellation policy values are recorded | BLOCKER | Owner-approved values and staged verification | B2, B3 |
| Guest stay requests | Public request flow and reception request workflow are implemented; reception is functionally closed for this release | No new reception request work is planned absent a critical defect | IMPLEMENTED | Existing 15/15 PostgreSQL browser acceptance | Closed |
| Management and hotel operations | CMS and manager operations for rooms, rates, inventory and reservation lifecycle exist | No manual walk-in/reception reservation path or dated maintenance blocks; the new board is read-only | REQUIRED | Safe shared inventory accounting and audited history | B1 |
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
- [ ] Add manual reception reservation entry and edits with audited source/history and the same concurrency-safe inventory claims.
- [ ] Add dated maintenance blocks with conflict checks against reservations and assignments.
- [ ] Complete the hosted PostgreSQL and browser acceptance rerun before considering this batch release-ready.

The read-only board does not activate online booking, payment, automatic allocation, room data, rates, or Production gates.
