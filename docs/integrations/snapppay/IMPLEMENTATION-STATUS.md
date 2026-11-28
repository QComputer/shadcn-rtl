# SnappPay implementation status

This status accompanies the SnappPay protocol handoff registered separately by PR #200. The merchant Self API specification and Stage environment acceptance remain required before live integration work can be enabled.

## Delivered in this change

- Additive `SNAPPPAY` integration-provider and `SNAPPPAY_INSTALLMENT` payment-method enum values. Existing integrations, methods, orders, and payment records are not rewritten.
- Migration `20261128140000_snapppay_installments` follows PR #197's final pending migration `20261128130000_hotel_damoon_data_import`; PR #199's current diff contains no Prisma schema or migration changes.
- Tenant-owned `OrganizationIntegration` records are used for provider identity. The integration catalog scopes SnappPay to `SHOP`; credential references stay in the existing credential-profile field and secrets are not stored in settings or source control.
- Server-side installment product pricing applies an exact Decimal multiplier of `111 / 100` to the ordinary discounted product unit price. Delivery fees are not uplifted. Coupons are evaluated after the marked-up product subtotal. Ordinary methods follow their existing price path.
- Fractional or non-positive whole-Toman installment totals fail closed because the provider amount contract has not yet been validated.
- SnappPay health checks remain blocked and no live provider request is implemented. Tenant policy defaults installments to disabled and refuses enabling them while the Self API contract, written 11% uplift approval, and Stage acceptance are outstanding.

## Activation gates

1. Obtain and validate the official merchant Self API contract, including authorization, request signing, callbacks, verification, settlement, cancellation, amount units, and idempotency behavior.
2. Obtain written SnappPay/provider approval that the 11% installment price difference is permitted for the merchant and product assortment.
3. Complete Stage acceptance using synthetic orders and provider-issued test credentials.
4. Review and implement the callback, verification, reconciliation, credential-vault resolution, and operational runbooks against the validated contract.
5. Obtain separate owner authorization before changing any rollout setting, credential, Production database, or live integration state.

No SnappPay purchase is exposed or activated by this change. Bank transfer, cash, guest checkout, customer identity, and existing payment records retain their current behavior.
