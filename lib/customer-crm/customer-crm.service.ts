import "server-only";

import prisma from "@/lib/db";
import { serializeCustomerIdentityForCrm } from "@/lib/customer-crm/customer-summary.service";
import { hashCustomerIdentifier, normalizeCustomerPhone } from "@/lib/customer-identity/customer-identity.service";

export async function listOrganizationCustomers(input: {
  organizationId: string;
  page?: number;
  pageSize?: number;
  search?: string | null;
}) {
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
  const search = input.search?.trim() || null;
  const normalizedPhone = normalizeCustomerPhone(search);
  const phoneHash = normalizedPhone ? hashCustomerIdentifier(input.organizationId, normalizedPhone) : null;

  const where = {
    organizationId: input.organizationId,
    ...(search
      ? {
          OR: [
            phoneHash ? { phoneHash } : undefined,
            { email: { contains: search, mode: "insensitive" as const } },
            { user: { name: { contains: search, mode: "insensitive" as const } } },
            { user: { email: { contains: search, mode: "insensitive" as const } } },
            { guestCustomer: { name: { contains: search, mode: "insensitive" as const } } },
            { guestCustomer: { email: { contains: search, mode: "insensitive" as const } } },
          ].filter((condition): condition is Exclude<typeof condition, undefined> => condition !== undefined),
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.customerIdentity.count({ where }),
    prisma.customerIdentity.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        guestCustomer: { select: { id: true, name: true, email: true, phone: true } },
        interactions: {
          orderBy: { occurredAt: "desc" },
          take: 1,
        },
        _count: {
          select: { interactions: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    customers: rows.map((row) => ({
      identity: serializeCustomerIdentityForCrm(row),
      interactionCount: row._count.interactions,
      lastInteraction: row.interactions[0] ?? null,
    })),
  };
}
