-- DropIndex
DROP INDEX "OrganizationMember_userId_key";

-- DropIndex
DROP INDEX "OrganizationMember_userId_organizationId_idx";

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "discountType" TEXT DEFAULT 'none',
ADD COLUMN     "discountValue" DECIMAL(65,30) DEFAULT 0;
