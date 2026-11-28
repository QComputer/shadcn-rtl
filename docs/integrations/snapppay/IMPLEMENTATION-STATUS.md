# SnappPay implementation status

This status accompanies the SnappPay protocol handoff registered separately by PR #200. The merchant Self API specification and Stage environment acceptance remain required before live integration work can be enabled. Current contract evidence and the separation between official guidance and plugin-only observations are recorded in [PROVIDER-CONTRACT-READINESS.md](./PROVIDER-CONTRACT-READINESS.md).

## Delivered in this change

- Additive `SNAPPPAY` integration-provider and `SNAPPPAY_INSTALLMENT` payment-method enum values. Existing integrations, methods, orders, and payment records are not rewritten.
- Migration `20261128140000_snapppay_installments` follows PR #197's final pending migration `20261128130000_hotel_damoon_data_import`; PR #199's current diff contains no Prisma schema or migration changes.
- Tenant-owned `OrganizationIntegration` records are used for provider identity. The integration catalog scopes SnappPay to `SHOP`; credential references stay in the existing credential-profile field and secrets are not stored in settings or source control.
- Additive lifecycle migration `20261128150000_snapppay_payment_lifecycle` adds a tenant-scoped merchant installment pricing policy and immutable order/payment-request quote snapshot with line-level original and adjusted merchandise amounts. It initializes Aka Shoes at 11% only when no policy row exists; all other tenants default to zero by absence, and any existing Aka Shoes manager value is preserved. No Production migration or seed was run.
- Installment merchandise pricing is a reusable, tenant-owned merchant policy. It uses exact Decimal arithmetic; Aka Shoes' owner-selected initial policy value is 11%, while newly absent policies default to 0%. No percentage is defined by or sent as a SnappPay provider parameter. Delivery fees are not uplifted, and ordinary CASH and BANK_TRANSFER prices stay on their existing path.
- Authorized tenant managers can edit the percentage, including zero. Checkout quotes include the policy version, percentage, ordinary merchandise subtotal and adjusted installment merchandise subtotal in the review token and display the installment price before final confirmation. A changed policy invalidates a stale review.
- Fractional or non-positive whole-Toman installment totals fail closed because the provider amount contract has not yet been validated.
- SnappPay health checks remain blocked and no live provider request is implemented. Tenant provider enablement defaults off and refuses enabling while Self API validation and Stage acceptance are outstanding. Merchant pricing remains subject to the merchant's applicable agreements and contractual compliance; provider approval of exactly 11% is not a standalone gate.
- Checkout includes policy version, applied percentage, original merchandise subtotal, adjusted merchandise subtotal and final payable total in the review token. It persists an immutable quote snapshot with the order and passes the exact finalized payable amount to the existing payment record; the provider lifecycle will reuse it when `PaymentRequest` is created. CASH and BANK_TRANSFER remain unchanged.
- This lifecycle follow-up adds provider-neutral exact-amount verification decisions, callback fingerprint classification, ambiguous-outcome reconciliation routing, safe audit shaping, and explicit cancellation/refund capability blocks. The append-only event ledger provides tenant/integration-scoped hash deduplication and stores no raw callback content. Provider-specific endpoint behavior remains pending.

## Activation gates

1. Obtain and validate the official merchant Self API contract, including authorization, request signing, callbacks, verification, settlement, cancellation, amount units, and idempotency behavior.
2. Confirm the merchant pricing policy complies with its applicable merchant agreement and contractual obligations; the exact 11% price adjustment does not require a separate SnappPay approval gate.
3. Complete Stage acceptance using synthetic orders and provider-issued test credentials.
4. Review and implement the callback, verification, reconciliation, credential-vault resolution, and operational runbooks against the validated contract.
5. Obtain separate owner authorization before changing any rollout setting, credential, Production database, or live integration state.

## Current follow-up boundary

- PR #200 tag search/docs and PR #201 pricing/tenant integration foundation remain separate and unchanged by this lifecycle follow-up.
- The lifecycle PR is based on PR #201. Agent 1 confirmed there is no PR199 migration overlap and no ordering conflict with `20261128150000_snapppay_payment_lifecycle`.
- Durable local callback replay protection is implemented through the digest-only event ledger. Provider transaction identity persistence and authoritative state changes remain pending official Self API details.

No SnappPay purchase is exposed or activated by this change. Bank transfer, cash, guest checkout, customer identity, and existing payment records retain their current behavior.
