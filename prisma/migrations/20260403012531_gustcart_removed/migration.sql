/*
  Warnings:

  - You are about to drop the `GuestCart` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GuestCartItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GuestCart";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GuestCartItem";
PRAGMA foreign_keys=on;
