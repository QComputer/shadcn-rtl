-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_targetUserId_idx" ON "Notification"("targetUserId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
