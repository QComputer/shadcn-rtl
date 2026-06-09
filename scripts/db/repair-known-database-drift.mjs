#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const statements = [
  'ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION',
  'ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION',
  'ALTER TABLE "OrganizationSettings" ADD COLUMN IF NOT EXISTS "deliveryFee" DOUBLE PRECISION DEFAULT 50000',
];

try {
  for (const statement of statements) {
    console.log(`Applying safe additive repair: ${statement}`);
    await prisma.$executeRawUnsafe(statement);
  }
  console.log("Known database drift repair completed.");
} finally {
  await prisma.$disconnect();
}
