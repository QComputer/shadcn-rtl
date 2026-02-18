import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Soft delete helper functions
// Note: Prisma 6.x removed the $use middleware. Soft delete must be handled at the service layer.
// Use these helper functions in your service queries:
// - addSoftDeleteFilter() - adds { deletedAt: null } to where clauses
// - softDelete() - sets deletedAt to current date for soft delete

export const softDelete = {
  /**
   * Add soft delete condition to where clause
   */
  addFilter: <T extends Record<string, unknown>>(where: T = {} as T): T => {
    return { ...where, deletedAt: null } as T;
  },

  /**
   * Create soft delete data
   */
  createData: () => {
    return { deletedAt: new Date() };
  },

  /**
   * Models that support soft delete
   */
  models: [
    "Organization",
    "User",
    "ServiceCategory",
    "Service",
    "Appointment",
    "ProductCategory",
    "Product",
    "ProductVariant",
    "Order",
    "OrderItem",
  ] as const,
};

export default prisma;
