-- Disposable upgrade-path fixture for the Restaurant 13 identity migration.
-- Run only against the named local proof database.
BEGIN;

INSERT INTO "User" (id, password, name, "updatedAt")
VALUES ('restaurant13-proof-user', 'disposable-hash', 'Restaurant 13 Proof User', now());

INSERT INTO "Organization" (id, type, name, slug, "updatedAt")
VALUES ('restaurant13-proof-org', 'SHOP', 'Restaurant 13', 'italiano-13', now());

INSERT INTO "OrganizationMember" (id, "organizationId", "userId", "organizationSlug")
VALUES ('restaurant13-proof-member', 'restaurant13-proof-org', 'restaurant13-proof-user', 'italiano-13');

INSERT INTO "OrganizationSettings" (id, "organizationSlug", "updatedAt")
VALUES ('restaurant13-proof-settings', 'italiano-13', now());

INSERT INTO "PaymentSettings" (id, "organizationSlug")
VALUES ('restaurant13-proof-payment-settings', 'italiano-13');

INSERT INTO "BookingSettings" (id, "organizationSlug", "updatedAt")
VALUES ('restaurant13-proof-booking-settings', 'italiano-13', now());

INSERT INTO "ProductCategory" (id, name, "organizationId", "organizationSlug", "updatedAt")
VALUES ('restaurant13-proof-category', 'Proof Category', 'restaurant13-proof-org', 'italiano-13', now());

INSERT INTO "Product" (id, name, "basePrice", "organizationId", "organizationSlug", "categoryId", "updatedAt")
VALUES ('restaurant13-proof-product', 'Proof Product', 1000, 'restaurant13-proof-org', 'italiano-13', 'restaurant13-proof-category', now());

INSERT INTO "Promotion" (id, code, "discountType", "discountValue", "startsAt", "expiresAt", "organizationSlug", "updatedAt")
VALUES ('restaurant13-proof-promotion', 'PROOF13', 'percentage', 10, now(), now() + interval '1 day', 'italiano-13', now());

INSERT INTO "ShopCart" (id, "organizationSlug", "sessionId", "updatedAt")
VALUES ('restaurant13-proof-cart', 'italiano-13', 'restaurant13-proof-session', now());

INSERT INTO "Order" (id, "orderNumber", type, subtotal, total, "organizationSlug", "updatedAt")
VALUES ('restaurant13-proof-order', 'PROOF-13-1', 'PICK_UP', 1000, 1000, 'italiano-13', now());

INSERT INTO "Review" (id, "organizationSlug", "updatedAt", "publicId")
VALUES ('restaurant13-proof-review', 'italiano-13', now(), '00000000-0000-4000-8000-000000000013');

INSERT INTO "OrganizationBranding" (id, "organizationId", "updatedAt")
VALUES ('restaurant13-proof-branding', 'restaurant13-proof-org', now());

INSERT INTO "OrganizationDomain" (id, "organizationId", domain, "normalizedDomain", status, "updatedAt")
VALUES ('restaurant13-proof-domain', 'restaurant13-proof-org', 'fastfood13.ir', 'fastfood13.ir', 'ACTIVE', now());

COMMIT;
