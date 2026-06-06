# Phase 18 overlay manifest

This overlay prepares Bazar Baz for the production-integrity/SMS-readiness track without sending any SMS and without storing SMS.ir secrets.

## Changed files

- `.env.example` — adds non-secret local/deployment environment template, including dry-run SMS placeholders.
- `README.md` — adds Phase 18 status row, SMS dry-run environment guidance, and roadmap note.
- `docs/SMS_IR_INTEGRATION.md` — documents the reviewed `sms-ir-api`/`sms-ir-node` contract and required Bazar Baz provider-boundary plan.
- `docs/PHASE_18_PRODUCTION_INTEGRITY_SMS_READINESS.md` — records the Phase 18 scope, safety rules, validation commands, and remaining clean-build tasks.
- `docs/PHASE_18_OVERLAY_MANIFEST.md` — this manifest.
- `scripts/quality/validate-env.mjs` — validates SMS provider/dry-run/live mode environment requirements.
- `lib/db.ts` — restores development PrismaClient reuse to avoid hot-reload client churn.

## Security notes

- No real SMS.ir API key is included in this overlay.
- The SMS.ir key pasted during planning must be considered exposed and should be rotated in the SMS.ir panel.
- The replacement key should be restricted to the production server IP before live sending is enabled.

## Validation run in this environment

```bash
node --check scripts/quality/validate-env.mjs
DATABASE_URL=postgresql://user:pass@localhost:5432/bazar_baz SMS_PROVIDER=dry_run SMS_DRY_RUN=true node scripts/quality/validate-env.mjs
NODE_ENV=production DATABASE_URL=postgresql://user:pass@localhost:5432/bazar_baz NEXTAUTH_SECRET=secret SMS_PROVIDER=sms_ir SMS_DRY_RUN=false node scripts/quality/validate-env.mjs
node scripts/quality/validate-project.mjs
```

Results:

- `validate-env.mjs` syntax check passed.
- dry-run environment validation passed.
- live SMS environment validation correctly failed when `SMS_IR_API_KEY` and `SMS_IR_LINE_NUMBER` were missing.
- `validate-project.mjs` passed.

## Not validated here

The uploaded project ZIP did not include `node_modules`, and dependency installation was not available in this environment. These checks still need to be run after applying the overlay locally:

```bash
npm ci
npm run db:generate
npm run db:validate
npm run typecheck
npm run lint
npm run build
```
