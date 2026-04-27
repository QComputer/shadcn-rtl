-- CreateTable
CREATE TABLE "OrderMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "senderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "persist" BOOLEAN DEFAULT true,

    CONSTRAINT "OrderMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderMessage_conversationId_idx" ON "OrderMessage"("conversationId");

-- CreateIndex
CREATE INDEX "OrderMessage_senderId_idx" ON "OrderMessage"("senderId");

-- CreateIndex
CREATE INDEX "OrderMessage_orderNumber_idx" ON "OrderMessage"("orderNumber");

-- CreateIndex
CREATE INDEX "OrderMessage_createdAt_idx" ON "OrderMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "OrderMessage" ADD CONSTRAINT "OrderMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMessage" ADD CONSTRAINT "OrderMessage_orderNumber_fkey" FOREIGN KEY ("orderNumber") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMessage" ADD CONSTRAINT "OrderMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
