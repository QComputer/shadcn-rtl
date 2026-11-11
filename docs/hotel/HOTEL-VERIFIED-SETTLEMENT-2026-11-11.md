# Verified Hotel settlement — 2026-11-11

This repository path reconciles an **already PAID** PaymentRequest and VERIFIED provider attempt. It does not call a provider, create a payment intent, or mark a payment PAID. Synthetic database evidence tests are not live gateway acceptance.

Checks bind organization, reservation/property metadata, guest, full TOMAN balance, active integration, merchant and credential snapshots, non-simulated verification, and payment/hold deadlines. A reservation row lock and unique allocation serialize duplicate reconciliation and cancellation. Cancelled reservations cannot be reconfirmed. Partial payments and refunds fail closed; no refund is invented.

Local isolated PostgreSQL acceptance passed with two organizations: foreign tenant/resource, amount/currency/guest mismatch, simulated/unverified evidence, expiry, duplicate concurrent callbacks, second payment, and cancellation winning a concurrent lock race. Cleanup passed. The workflow repeats this test against an ephemeral PostgreSQL 17 service.

No operational route or feature flag is enabled by this package. Next dependency: operational Hold/reservation orchestration and reception, using this confirmation boundary; provider intent/refund adapters remain separate work. Production and main require owner approval.
