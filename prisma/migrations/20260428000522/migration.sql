-- AlterTable
ALTER TABLE "OrganizationSettings" ALTER COLUMN "deliveryFee" SET DEFAULT 50000;

-- AlterTable
ALTER TABLE "PaymentSettings" ADD COLUMN     "cardOwnerName" TEXT;
