import "server-only";

import type { CustomerInteraction, BusinessEvent } from "@prisma/client";

export type CustomerActivityClass = "ACTIVE" | "INACTIVE" | "NEW";

export function classifyCustomerActivity(input: {
  totalInteractions: number;
  lastInteractionAt?: Date | null;
  now?: Date;
}): CustomerActivityClass {
  if (input.totalInteractions === 0) return "NEW";
  if (!input.lastInteractionAt) return "INACTIVE";
  const now = input.now ?? new Date();
  const daysSinceLastInteraction = (now.getTime() - input.lastInteractionAt.getTime()) / 86_400_000;
  return daysSinceLastInteraction <= 30 ? "ACTIVE" : "INACTIVE";
}

export function calculateCustomerActivityScore(input: {
  totalInteractions: number;
  recentInteractions: number;
  businessEvents: number;
  orderCount?: number;
}) {
  return Math.min(
    100,
    input.totalInteractions * 4 +
      input.recentInteractions * 8 +
      input.businessEvents * 3 +
      (input.orderCount ?? 0) * 10,
  );
}

export function detectRepeatCustomer(input: {
  orderCount?: number;
  interactions?: Pick<CustomerInteraction, "type">[];
  businessEvents?: Pick<BusinessEvent, "type">[];
}) {
  if ((input.orderCount ?? 0) > 1) return true;
  const orderInteractions = input.interactions?.filter((interaction) => interaction.type === "ORDER_CREATED").length ?? 0;
  const orderEvents = input.businessEvents?.filter((event) => event.type === "ORDER_CREATED").length ?? 0;
  return orderInteractions + orderEvents > 1;
}
