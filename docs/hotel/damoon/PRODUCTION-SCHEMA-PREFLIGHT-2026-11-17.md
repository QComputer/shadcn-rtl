# Hotel Damoon Production schema preflight — 2026-11-17

Status: `BLOCKED_PENDING_MIGRATION_LINEAGE_RECONCILIATION`

This is a sanitized record of one read-only Runflare PostgreSQL inspection.
The connection URI and server address are deliberately omitted.

## Target verification

- PostgreSQL database identity: `maindbfsi_db`
- PostgreSQL version number: `170005`
- Session default read-only: `on`; inspection ran in a read-only transaction.
- Organization: `cmvbltspu0000jt08zfn7xltj`, slug `damoon-hotel`, vertical `HOTEL`, active and not deleted.
- Property: `cmvbltsrc0009jt08k3o8jdip`, slug `damoon-hotel`, active and not deleted.
- Existing check-in: `14:00`; observed check-out: `11:00`.
- `HOTEL_BOOKING` and `HOTEL_WEBSITE`: `ACTIVE`, `enabledAt` present, `disabledAt` null.

No Production writes were made and no migration row was edited.

## Current source-to-ledger comparison

The inspected `origin/main` baseline was `40ebcb7479d82ef56052c02b0a85a1330b98cd7d`.

- Source migration directories: 125.
- Production migration rows: 124; distinct source migration names completed: 120.
- Completed rows: 120; rolled-back rows: 4; unfinished, non-rolled-back rows: 0.
- No ledger migration names absent from the current source were found.
- Five source migrations are not present in the ledger:
  - `20261114130000_hotel_operational_modes_and_stay_requests`
  - `20261114140000_hotel_offline_payments`
  - `20261114150000_hotel_reservation_payment_policy`
  - `20261114160000_hotel_pending_payment_deadline`
  - `20261114170000_hotel_offline_payment_audit`

Execution order and dependencies:

1. `20261114130000_hotel_operational_modes_and_stay_requests` adds the
   operational/request enums, adds `HotelProperty.operationalMode`, and creates
   tenant-bound quote/request tables referencing the existing property key.
2. `20261114140000_hotel_offline_payments` creates payment enums and ledger,
   command-idempotency tables, and a tenant-bound FK to the existing
   `HotelReservation(id, organizationId)` key.
3. `20261114150000_hotel_reservation_payment_policy` depends on the payment
   enum/table from step 2 and adds property policy fields, nullable
   `HotelReservation.paymentMethod`, and the payment `receiptKey`.
4. `20261114160000_hotel_pending_payment_deadline` adds a defaulted property
   deadline and its range constraint.
5. `20261114170000_hotel_offline_payment_audit` extends the command enum from
   step 2 and adds append-only payment audit records referencing the step-2
   ledger. The SQL is ordered after steps 3 and 4 by the repository's
   migration sequence.

The repository migration directory order is therefore 13 → 14 → 15 → 16 → 17.
The hard dependencies are 13 before the property-based request use, 14 before
15 and 17, and 15 before 16 only by file order (16 itself adds a property
column). Do not run any later migration while one of its enum/table prerequisites
is absent.
- 27 completed migration checksums differ from the current `origin/main` SQL:
  - `20260707000200_export_hub_extend_data_types`
  - `20260815000500_organization_integration_foundation`
  - `20260815000600_relax_integration_capability_links`
  - `20260815000700_integration_runtime_foundation`
  - `20260815000800_customer_identity_foundation`
  - `20260815000900_demo_universe_backend_foundation`
  - `20260815001000_demo_public_api_events`
  - `20260815001100_demo_conceptual_roles`
  - `20260815001200_external_catalog_foundation`
  - `20260815001300_demo_scenario_foundation`
  - `20260815001400_external_catalog_approval_workflow`
  - `20260815001500_business_entity_graph_seo_foundation`
  - `20260815001600_seo_content_iam_foundation`
  - `20260815001700_business_acquisition_onboarding_foundation`
  - `20260815001800_business_activation_plan_foundation`
  - `20260815001900_owner_activation_task_flow`
  - `20260815002000_customer_trust_reputation_foundation`
  - `20260815002100_pilot_workspace_foundation`
  - `20260815002200_growth_intelligence_foundation`
  - `20260823000100_real_inoti_runtime_foundation`
  - `20260823000200_platform_inoti_integration_owner`
  - `20260827_organization_branding`
  - `20260827_public_home_mode`
  - `20260830000100_reconcile_payment_money_semantics`
  - `20260830000200_inoti_payment_e2e`
  - `20260830000300_tenant_branding_extensions`
  - `20260831000100_inoti_durable_payment_reconciliation`

The exact SHA-256 pairs below were rechecked against the current `origin/main`
SQL at `40ebcb7479d82ef56052c02b0a85a1330b98cd7d`; all 27 repository hashes
match the source column in the earlier manifest. The Production column records
the checksum previously observed for the same completed ledger rows in the
read-only Runflare comparison.

| Migration | Current repository SHA-256 | Production ledger SHA-256 |
| --- | --- | --- |
| `20260707000200_export_hub_extend_data_types` | `7781531739ffd2a222e9a0e73d1cd762109aa96179ea14b011bfe752e449dc5f` | `a024000331ef7d5383ac8043e618619470487911bb35d0662169a38c13465b68` |
| `20260815000500_organization_integration_foundation` | `4db2c296bd187a54e8fb4a59aa255692c0be2a041ab397e3f9f8eb5257b5dc7b` | `024481358adbb78ca80268d07c00e473e75ccaa8eeeaf4b3d6666d737fc058d7` |
| `20260815000600_relax_integration_capability_links` | `c046b70a63a3d5657c3759591af476f4ebf77c9b3e7ddb52bdf2e37fde2ee2d2` | `abcc4e01171435b29fffc37a4217b844d94cbbe204a4ca93b4ab4e74f1cc1507` |
| `20260815000700_integration_runtime_foundation` | `b4c8da5cbcbab71b113016dfa6aa52de0f5ed1fd75ab39eefb2139722d0cb2aa` | `59591250103c7465784513727d3157f525796149232a0f7c8174a04a88026b24` |
| `20260815000800_customer_identity_foundation` | `8bc20c73fce6dbefc9de99609a9b89e36bc784db0ce57c558eac0f3bdf6adab0` | `ce8d5180dec4150f629600523ea9768e0afec912aceeb8d5a2f51f9218878192` |
| `20260815000900_demo_universe_backend_foundation` | `596ce97453554f6163310571855184f20e9f145be07cbb8d0f942c9e0d468b7b` | `d249877e3da57d7d980f2842a1237a1d4831325b37c028a4b9616b28e7051ace` |
| `20260815001000_demo_public_api_events` | `a98c06e7d150116393eb09b06be4ba1e6752b1798a767f0c0b720e1f8b40631a` | `f07d298c7563b6c9604d87b8fedb70da661adb2696f7850030c3136385f335d3` |
| `20260815001100_demo_conceptual_roles` | `76144cacc80d1c07d93fa8802b30450c9fc6048ab6a832e6c32d0f932e22689f` | `82aef474323b243f695c3c51b40358369b7a65faeee24890dbb22f2c375a1448` |
| `20260815001200_external_catalog_foundation` | `ae3e24ba30d338c0778c6c3d2d87e25a45697d1e4af1db2d887ac95d16c7b9df` | `2d1bb84dbf0e87ae71c2c3d93e01754ad0ea25eaea65976f51432c834ac9604f` |
| `20260815001300_demo_scenario_foundation` | `c193cc7998222b71af6f32d9dc1fef6902e11b2c0b850cb79e8b5cb99898dd4a` | `1a22eeb09bd42c21108714bdabcf18d47f1d1b90fbc6ad4d1d10b5b6e3cc5e6c` |
| `20260815001400_external_catalog_approval_workflow` | `3119e9f0e42393912b6d070b67b4da4acfb30892b294e3642b8e633d329540d9` | `45c469ffc51e6678a968dc5e7279b3747c257bec00fe0adf88e87196a64deed9` |
| `20260815001500_business_entity_graph_seo_foundation` | `4b70909776b8f6f314d39b50c4e7047b848e7a8df14c0f25d4b25ad8c6105941` | `c7d28cefb57622957d8d7b10981e78b131804096235115944fc5e8925c5f8f6d` |
| `20260815001600_seo_content_iam_foundation` | `e1d8cc53596523cd1c92d34d4300037daa5eab4567a152c90824ac27f89d5eec` | `9bb8e5c8824bb24f2d616aedb296c55830dd9e4347fddbb20f30ffc88d7da695` |
| `20260815001700_business_acquisition_onboarding_foundation` | `36a3713c0013d4b5216ce3c81ae85ede5242b28e999eb7ad67daa7d62e60b376` | `8c345f31e19d8b330c85a0a6add17f63384da67df70b4bd96b49ed6276ed39c7` |
| `20260815001800_business_activation_plan_foundation` | `1c32bd6b795d88a2053e08a329573f09eb97669924e33cb6389e1009081598d9` | `6d3fb83f672ee1a2408a0aeda992934dfeff9ac9dba5b02249776bb34afc9e0d` |
| `20260815001900_owner_activation_task_flow` | `f7f02021c1d60170b27a3df7438643e04407bab05355ae5d434a120e00f1d728` | `009f1fdd22d5b53ff0736ab842386a3c38f6509dafe65a2c0439be0fad7616d9` |
| `20260815002000_customer_trust_reputation_foundation` | `ced7f8723ee3831460318514bfebce5a65bb9ad8417d56337b8caeeffae8c2f5` | `5e5736ae44a7a906302c65d5cbb3410f22887731aa3a655744b1323d7f791478` |
| `20260815002100_pilot_workspace_foundation` | `e68d3dfd88dfea345fd7cdf1de26d8f15247230283a866a5359a4f3c777ed110` | `6a0fec5915063abd29ebc12994f5749c3a169875a82233cddf125f718f1be2f4` |
| `20260815002200_growth_intelligence_foundation` | `58f5452ebd717f4236df1f2d4a8018e7c0ceed68a62ce0ccae632dde71768c11` | `3c947020e6016056f5fcaf5b296d410fb71e4813a802367b3e6adb3a034067aa` |
| `20260823000100_real_inoti_runtime_foundation` | `3f4546e2049a1fa2db361d3e12bf3f3ea80d656043ac550fd271282976b47abe` | `05dd51968e45f3cddab956d93c25046444eb43b0071d032d83aa4d0ae0ef7e52` |
| `20260823000200_platform_inoti_integration_owner` | `052447369ab8644a3e736cbc8d82b47cb69c2c5077bbfbae778c8dd883f2893e` | `085ab1c4b98014f29a474c167b70718921bd090d18f806b8bf9766f9d9af206b` |
| `20260827_organization_branding` | `bc39fdfe5338c76d88c6c6bfcb3511f7d66467849dbad9cb9a940d2f98c5582b` | `3e8b2d7623152c6fad1345439fba72a83b7239dc0d5cfaef0d75633cc6baa5c7` |
| `20260827_public_home_mode` | `ec0b80f0133ff6e80a60bc8e6493e1d0dfb2b7de73b6a1733e42ce052b7403bf` | `39c1cc3712d7f612898238dcbd41097f14360c763fd298ea443de64737afb694` |
| `20260830000100_reconcile_payment_money_semantics` | `f91c0d4e21223fb80afc4b2dc7eae943a93d105c4747992f8e8a2d28dad89921` | `cdea7cde5340a5e1281eadc3dae1aa98baf8cabe88be0b97ddfeb046b3167204` |
| `20260830000200_inoti_payment_e2e` | `1a4e4ef31ff30b64a3936656bcd46804dcfe835bddbfee903fde37ceab160839` | `3b62659539192be2b7580ca05749086cff5ba5bdcbfa80a8a93bd8449eb28c85` |
| `20260830000300_tenant_branding_extensions` | `3de97f58cf547965e2407b69ae3c9884b59e0ea3ce9a26b0a2d7a7176dfd0ca7` | `f863060765ac6cd932043f951d050ef9c227302b96657f100ccbe81f2053904d` |
| `20260831000100_inoti_durable_payment_reconciliation` | `99dafd4cbed9b033d7e9b3901ee2b40d2c82d2c5bf9f5fa7407e459190a1e107` | `3a59909bcfd26c36893c6c610b9b7bb65e13e350a59bbe9815898458d227d70e` |
- Four rollback rows are associated with three migration names:
  - `20260628000100_import_hub_foundation`: one rolled-back attempt.
  - `20260703000100_add_creative_studio_asset_rolled_back`: one rolled-back attempt.
  - `20260824000100_ussd_event_observability`: two rolled-back attempts and one completed row.
- Thirteen successful migration ordering inversions were observed from
  successful-row `finished_at` ordering, grouped by the later-named migration
  that completed first:
  - `20260629008700_add_ai_media_usage_events` completed before
    `20260629000400_notification_preferences`,
    `20260629000500_web_push_delivery`, and
    `20260629000600_sms_provider_delivery`.
  - `20260629008900_imported_product_ai_media_bridge` completed before those
    same three migrations.
  - `20260707000100_request_demo_lead_storage` and
    `20260707000200_export_hub_extend_data_types` each completed before
    `20260703000100_add_creative_studio_asset_rolled_back`,
    `20260703000200_notification_delivery_attempt`, and
    `20260703000300_sms_delivery_guest_customer`.
  - `20260831000100_inoti_durable_payment_reconciliation` completed before
    `20260830000300_tenant_branding_extensions`.

The earlier repository migration review also documents that historical SQL and
the Production ledger must not be rewritten to hide lineage differences.
Successful fresh-database migration acceptance does not resolve this live
lineage blocker.

## Schema comparison for the five pending migrations

All of the following objects were absent, as expected for the missing
migrations:

- Types: `HotelOperationalMode`, `HotelStayRequestStatus`,
  `HotelOfflinePaymentMethod`, `HotelOfflinePaymentStatus`,
  `HotelOfflinePaymentCommandType`, `HotelManualConfirmationPolicy`, and
  `HotelOfflinePaymentAuditEventType`.
- Tables: `HotelStayQuote`, `HotelStayRequest`, `HotelOfflinePayment`,
  `HotelOfflinePaymentCommandIdempotency`, and
  `HotelOfflinePaymentAuditEvent`.
- `HotelProperty` columns: `operationalMode`,
  `manualConfirmationPolicy`, `allowedOfflinePaymentMethods`,
  `minimumVerifiedDepositAmount`, and `pendingPaymentMinutes`.
- `HotelReservation.paymentMethod` and `HotelOfflinePayment.receiptKey`.

No partial application of these five migrations was observed. The five
existing migrations are additive: they add enum values/types, nullable or
defaulted fields, new tables, checks, foreign keys, and indexes. No `DROP`,
`TRUNCATE`, or data-deletion statement is present in these five SQL files.
That characterization does not by itself authorize Production migration.

## Damoon operational records

For the exact target organization/property, the read-only counts were:

| Model | Rows |
| --- | ---: |
| HotelProperty | 1 |
| HotelRoomType | 0 |
| HotelRoom | 0 |
| HotelRatePlan | 0 |
| HotelInventory | 0 |
| HotelReservation | 0 |
| HotelBookingHold | 0 |
| HotelGuestBookingRequest | 0 |

No rooms, rates, inventory, reservations, holds, payments, or test bookings
were created by this preflight.

## Safe next steps

1. Resolve the historical checksum/rollback/order discrepancies through the
   repository's approved migration-lineage procedure. Do not use
   `prisma migrate resolve` or edit ledger rows as a shortcut. The earlier
   source audit recovered one historical blob; 26 divergent SQL versions were
   not found in available Git history.
2. The CI workflow runs two separate disposable PostgreSQL 17 rehearsals. The
   first uses the current-source migration chain with the final five Hotel
   migrations withheld, seeds synthetic pre-gap rows, then checks the additive
   migrations and tenant-scoped property service. The second creates an
   isolated schema whose pre-gap `HotelProperty` and `HotelReservation` column,
   tenant-key and existing-row shape is based on the read-only Production
   catalog inspection; it runs exactly these five SQL files and checks legacy
   values, safe defaults and cross-tenant composite FKs. Neither rehearsal
   copies Production rows or reproduces the full 27-migration divergent
   lineage, all unrelated Production tables, or migration execution history.
   They improve compatibility coverage but are **not** proof that a
   Production migration is safe.
3. Build and rehearse an authentic Production-lineage clone only after the
   missing historical SQL and a sanitized exact schema/ledger snapshot are
   available. No direct Production `migrate deploy`, ledger repair, or manual
   DDL is authorized by this preflight.
4. Obtain the required migration authorization and use the established
   deployment workflow. Do not apply these migrations directly from this
   workstation.
5. Only after schema compatibility is established, apply the owner-approved
   `checkOutTime = "12:00"` update to the exact target through the authorized
   property-management API and verify it with a new read-only transaction.
