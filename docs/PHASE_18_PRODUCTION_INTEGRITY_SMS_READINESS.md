# Phase 18 — Production integrity and SMS readiness

Phase 18 is the first hardening phase after the whole-project re-inspection. It does not complete the full SMS feature; it prepares safe project hygiene and environment rules so that a future SMS implementation cannot accidentally send real messages during development or tests.

## Scope in this overlay

This overlay intentionally keeps the changes small and safe:

- adds `.env.example` with non-secret placeholders;
- documents the SMS.ir integration contract in `docs/SMS_IR_INTEGRATION.md`;
- extends `scripts/quality/validate-env.mjs` with SMS dry-run/live-mode validation;
- re-enables Prisma client reuse during development in `lib/db.ts`;
- updates README to include Phase 18 and SMS environment notes.

## Out of scope for this overlay

The following items are still required for full Phase 18 completion but were not completed here because dependency installation/build validation was not available in the current execution environment:

- regenerate `package-lock.json`;
- install/add `sms-ir-api` as a dependency;
- run `npm ci`;
- run Prisma generate/validate with installed dependencies;
- run TypeScript, lint, and Next build;
- remove any currently tracked `.env`/local database artifacts from Git history.

## SMS safety requirements

The project must follow these rules from this phase onward:

- default provider is `dry_run`;
- default `SMS_DRY_RUN` is `true`;
- no automated test, smoke script, seed script, or quality doctor sends real SMS;
- real SMS requires `SMS_PROVIDER=sms_ir`, `SMS_DRY_RUN=false`, `SMS_IR_API_KEY`, and `SMS_IR_LINE_NUMBER`;
- exposed SMS.ir API keys must be rotated and IP-restricted in the SMS.ir panel.

## Local validation commands

With a PostgreSQL URL set:

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/bazar_baz \
SMS_PROVIDER=dry_run \
SMS_DRY_RUN=true \
npm run health:env
```

For a real production environment, the validation must fail if real SMS is enabled without required SMS.ir credentials:

```bash
NODE_ENV=production \
DATABASE_URL=postgresql://user:pass@localhost:5432/bazar_baz \
NEXTAUTH_SECRET=replace-with-real-secret \
SMS_PROVIDER=sms_ir \
SMS_DRY_RUN=false \
npm run health:env
```

## Next implementation step

After the project has a green clean-install/build gate, add the actual provider abstraction under `lib/sms/`, install `sms-ir-api`, and add dry-run tests before connecting any auth/order/appointment workflow to SMS.
