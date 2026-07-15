# Bazar Baz Handoff Snapshot 08 - Validation Report

Validation run date: 2026-07-15

## Core Required Gates

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm run db:generate` | passed | Prisma Client generated with Prisma 6.19.3 |
| `pnpm run db:validate` | passed | Schema valid |
| `pnpm run typecheck` | passed | `tsc --noEmit --incremental false` |
| `pnpm run build` | passed | Next.js 16.2.7 production build compiled, typed, generated 215 static pages |
| `git diff --check` | passed | no whitespace errors |
| `pnpm run quality:source-baseline` | passed | tracked source has no committed secret env values |

## B2B Validators

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm run quality:b2b-homepage-landing` | passed | 34 checks |
| `pnpm run quality:b2b-public-route-policy` | passed | 27 checks |
| `pnpm run quality:b2b-demo-business-portfolio` | passed | 38 checks |
| `pnpm run quality:b2b-conversion-funnel` | passed | 38 checks |
| `pnpm run quality:b2b-dashboard-showcase` | passed | 44 checks |
| `pnpm run quality:b2b-seo-trust-legal` | passed | 49 checks |
| `pnpm run quality:b2b-request-demo-leads` | passed | 50 checks |
| `pnpm run quality:b2b-custom-domain-onboarding` | passed | 52 checks |

## Notification/SMS/Web Push Validators

| Command | Status | Notes |
| --- | --- | --- |
| `pnpm run quality:notification-operations` | passed | dashboard/service/source checks passed |
| `pnpm run quality:notification-delivery-observability` | passed | delivery attempt checks passed |
| `pnpm run quality:notification-retry-policy` | passed | retry policy checks passed |
| `pnpm run quality:notification-ops-deployed-safety` | passed | 27 checks |
| `pnpm run quality:realtime-production-config` | passed | 22 checks |
| `pnpm run quality:sms-ir-provider-completion` | passed | server-only SMS.ir provider checks passed |
| `pnpm run quality:sms-delivery-reports` | passed | report endpoint/client masking checks passed |
| `pnpm run quality:sms-provider-reconciliation` | passed | no SMS send/order mutation during reconciliation |
| `pnpm run quality:sms-provider-report-endpoints` | passed | official report endpoint integration checks passed |
| `pnpm run quality:sms-real-send-gates` | passed | real-send gates and no browser SMS key checks passed |
| `pnpm run quality:web-push-foundation` | passed | 54 checks |
| `pnpm run quality:web-push-capability-detection` | passed | 27 checks |
| `pnpm run quality:sms-provider` | failed | 2 doc-baseline checks failed: README and roadmap still expect old P109 wording |
| `pnpm run quality:web-push-delivery` | failed | 2 doc-baseline checks failed: README and roadmap still expect old P109 wording |

## Skipped Or Not Run

| Command | Status | Reason |
| --- | --- | --- |
| `pnpm run lint` | skipped in this handoff run | not required by this handoff prompt; prior P11-FIX1 run passed with existing warnings |
| `pnpm run quality:local` | skipped | prompt requested relevant validators; global quality local has known separately classified legacy validator behavior |
| Real custom-domain smoke | skipped | requires authorized real custom-domain fixture and provider/domain state |
| Real SMS send smoke | skipped | not authorized and intentionally gated |
| Real payment smoke | skipped | not in scope and not authorized |

## Summary

Core build/type/schema gates are green. B2B source validators are green. Most notification/SMS/Web Push validators are green. The only failures in this handoff pass are documentation-baseline checks in `quality:sms-provider` and `quality:web-push-delivery`, not provider secret-safety or implementation checks.

