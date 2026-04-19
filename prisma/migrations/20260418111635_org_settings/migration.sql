-- AlterTable
ALTER TABLE "OrganizationSettings" ALTER COLUMN "settings" DROP NOT NULL,
ALTER COLUMN "currency" DROP NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'IRR',
ALTER COLUMN "emailNotifications" SET DEFAULT false;
