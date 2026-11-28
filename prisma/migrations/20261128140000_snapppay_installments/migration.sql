-- Additive provider and checkout method values only.
-- Existing payment methods and records are preserved; no rows are backfilled.
ALTER TYPE "IntegrationProvider" ADD VALUE 'SNAPPPAY';
ALTER TYPE "PaymentMethod" ADD VALUE 'SNAPPPAY_INSTALLMENT';
