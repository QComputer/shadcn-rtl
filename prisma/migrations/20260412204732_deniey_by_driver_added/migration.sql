-- CreateTable
CREATE TABLE "_DriverDeniedOrdes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DriverDeniedOrdes_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_DriverDeniedOrdes_B_index" ON "_DriverDeniedOrdes"("B");

-- AddForeignKey
ALTER TABLE "_DriverDeniedOrdes" ADD CONSTRAINT "_DriverDeniedOrdes_A_fkey" FOREIGN KEY ("A") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DriverDeniedOrdes" ADD CONSTRAINT "_DriverDeniedOrdes_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
