-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "seen" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "type" DROP NOT NULL;
