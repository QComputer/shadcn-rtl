import "server-only";

import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { maskPhoneNumber } from "@/lib/sms/phone-normalization";
import {
  calculateCustomerActivityScore,
  classifyCustomerActivity,
  detectRepeatCustomer,
} from "@/lib/customer-crm/customer-metrics.service";

export function maskEmail(email?: string | null) {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

export function serializeCustomerIdentityForCrm(identity: {
  id: string;
  publicId: string;
  organizationId: string;
  userId?: string | null;
  guestCustomerId?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user?: { id: string; name: string; email?: string | null; phone?: string | null } | null;
  guestCustomer?: { id: string; name: string; email?: string | null; phone?: string | null } | null;
}) {
  const phone = identity.phone ?? identity.user?.phone ?? identity.guestCustomer?.phone ?? null;
  const email = identity.email ?? identity.user?.email ?? identity.guestCustomer?.email ?? null;
  return {
    id: identity.id,
    publicId: identity.publicId,
    organizationId: identity.organizationId,
    status: identity.status,
    contact: {
      phoneMasked: phone ? maskPhoneNumber(phone) : null,
      emailMasked: maskEmail(email),
    },
    linkedUser: identity.user
      ? { id: identity.user.id, name: identity.user.name, phoneMasked: identity.user.phone ? maskPhoneNumber(identity.user.phone) : null, emailMasked: maskEmail(identity.user.email) }
      : null,
    linkedGuest: identity.guestCustomer
      ? { id: identity.guestCustomer.id, name: identity.guestCustomer.name, phoneMasked: identity.guestCustomer.phone ? maskPhoneNumber(identity.guestCustomer.phone) : null, emailMasked: maskEmail(identity.guestCustomer.email) }
      : null,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
  };
}

export async function getCustomerSummary(input: {
  organizationId: string;
  customerIdentityId: string;
}) {
  const identity = await prisma.customerIdentity.findFirst({
    where: { id: input.customerIdentityId, organizationId: input.organizationId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      guestCustomer: { select: { id: true, name: true, email: true, phone: true } },
    },
  });
  if (!identity) throw new ApiError(404, "Customer identity not found");
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { slug: true },
  });
  if (!organization) throw new ApiError(404, "Organization not found");
  const orderIdentityFilter = [
    identity.userId ? { customerId: identity.userId } : undefined,
    identity.guestCustomerId ? { guestCustomerId: identity.guestCustomerId } : undefined,
  ].filter((condition): condition is Exclude<typeof condition, undefined> => condition !== undefined);

  const [totalInteractions, recentInteractions, latestBusinessEvents, orderCount] = await Promise.all([
    prisma.customerInteraction.count({
      where: { organizationId: input.organizationId, customerIdentityId: input.customerIdentityId },
    }),
    prisma.customerInteraction.findMany({
      where: { organizationId: input.organizationId, customerIdentityId: input.customerIdentityId },
      orderBy: { occurredAt: "desc" },
      take: 10,
    }),
    prisma.businessEvent.findMany({
      where: { organizationId: input.organizationId, customerIdentityId: input.customerIdentityId },
      orderBy: { occurredAt: "desc" },
      take: 10,
    }),
    prisma.order.count({
      where: orderIdentityFilter.length > 0
        ? { organizationSlug: organization.slug, OR: orderIdentityFilter }
        : { id: "__no_order_identity__" },
    }),
  ]);

  const lastInteraction = recentInteractions[0] ?? null;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const recentInteractionCount = recentInteractions.filter((interaction) => interaction.occurredAt >= thirtyDaysAgo).length;

  return {
    identity: serializeCustomerIdentityForCrm(identity),
    metrics: {
      totalInteractions,
      lastInteractionAt: lastInteraction?.occurredAt ?? null,
      customerActivityScore: calculateCustomerActivityScore({
        totalInteractions,
        recentInteractions: recentInteractionCount,
        businessEvents: latestBusinessEvents.length,
        orderCount,
      }),
      activityClass: classifyCustomerActivity({
        totalInteractions,
        lastInteractionAt: lastInteraction?.occurredAt ?? null,
        now,
      }),
      repeatCustomer: detectRepeatCustomer({
        orderCount,
        interactions: recentInteractions,
        businessEvents: latestBusinessEvents,
      }),
      orderCount,
    },
    recentInteractions,
    latestBusinessEvents,
  };
}
