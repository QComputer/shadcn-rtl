import "server-only";

import type { CustomerIdentityStatus } from "@prisma/client";
import { classifyCustomerActivity } from "@/lib/customer-crm/customer-metrics.service";

export function deriveCustomerSegment(input: {
  status: CustomerIdentityStatus;
  totalInteractions: number;
  lastInteractionAt?: Date | null;
}) {
  if (input.status !== "ACTIVE") return input.status.toLowerCase();
  return classifyCustomerActivity(input).toLowerCase();
}
