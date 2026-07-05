# Demo Seed Safety Policy

This document defines the safety rules for demo data seeding in Bazar Baz.

## Core rules

- Demo seed must be dry-run by default.
- Production writes require explicit env flag `DEMO_SEED_WRITE_ENABLED=true`.
- Production writes require explicit acknowledgement `DEMO_SEED_PRODUCTION_ACK=I_UNDERSTAND_THIS_WRITES_DEMO_DATA`.
- Demo seed must be idempotent.
- Demo seed must not send real SMS.
- Demo seed must not create real payments.
- Demo seed must not include real phone numbers.
- Demo seed must not use real customer personal data.
- Demo seed must use anonymized/fake customer data only.

## Local/Dev

- Local demo seeding is allowed for development and QA.
- Local seeds must still use fake/anonymized data.
- Local seeds should not depend on production data.

## Rollback

- Every demo seed operation should be reversible.
- Demo tenants should be removable without affecting real tenants.
- Demo data should be clearly tagged/flaggable for bulk removal.

## Production guardrails

- Do not run demo seed against production without explicit written approval.
- Production demo seeding must be announced and time-bounded.
- Production demo data must be clearly distinguishable from real tenant data.
