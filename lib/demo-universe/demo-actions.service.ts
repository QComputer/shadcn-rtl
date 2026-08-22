import "server-only";

import { randomUUID } from "node:crypto";
import type { DemoSessionToken } from "@prisma/client";
import prisma from "@/lib/db";
import { recordCustomerInteraction } from "@/lib/customer-identity/customer-identity.service";
import { recordBusinessEvent } from "@/lib/integrations/runtime/business-events";
import { resolveDemoSessionCustomerIdentity } from "@/lib/demo-universe/demo-dashboard.service";
import {
  completeDemoScenarioStep,
  transitionDemoOrder,
} from "@/lib/demo-universe/demo-scenario.service";

export async function createDemoOrder(input: {
  organizationId: string;
  organizationSlug: string;
  session: DemoSessionToken;
}) {
  const identity = await resolveDemoSessionCustomerIdentity(input);
  const order = await prisma.order.create({
    data: {
      orderNumber: `DEMO-${randomUUID().slice(0, 8).toUpperCase()}`,
      type: "DELIVERY",
      status: "PLACED",
      subtotal: 100,
      total: 100,
      organizationSlug: input.organizationSlug,
      notes: "Demo Universe order",
    },
  });
  const event = await recordBusinessEvent({
    organizationId: input.organizationId,
    customerIdentityId: identity.id,
    type: "ORDER_CREATED",
    entityType: "Order",
    entityId: order.id,
    payload: { orderNumber: order.orderNumber, status: order.status },
    metadata: { demoUniverse: true },
  });
  await recordCustomerInteraction({
    organizationId: input.organizationId,
    customerIdentityId: identity.id,
    businessEventId: event.id,
    type: "ORDER_CREATED",
    entityType: "Order",
    entityId: order.id,
    summary: `Demo order ${order.orderNumber} created`,
    metadata: { demoUniverse: true },
  });
  await completeDemoScenarioStep({
    organizationId: input.organizationId,
    session: input.session,
    stepKey: "customer-place-order",
    metadata: { orderId: order.id, orderNumber: order.orderNumber },
  });
  return { order, event };
}

export async function prepareDemoOrder(input: {
  organizationId: string;
  orderId: string;
  session?: DemoSessionToken;
}) {
  const order = await transitionDemoOrder({
    organizationId: input.organizationId,
    orderId: input.orderId,
    actorRole: "STAFF",
    nextStatus: "PREPARING",
  });
  if (input.session) {
    await completeDemoScenarioStep({
      organizationId: input.organizationId,
      session: input.session,
      stepKey: "staff-prepare-order",
      metadata: { orderId: input.orderId },
    });
  }
  return order;
}

export async function readyDemoOrder(input: {
  organizationId: string;
  orderId: string;
  session?: DemoSessionToken;
}) {
  const order = await transitionDemoOrder({
    organizationId: input.organizationId,
    orderId: input.orderId,
    actorRole: "STAFF",
    nextStatus: "READY",
  });
  if (input.session) {
    await completeDemoScenarioStep({
      organizationId: input.organizationId,
      session: input.session,
      stepKey: "staff-ready-order",
      metadata: { orderId: input.orderId },
    });
  }
  return order;
}

export async function deliverDemoOrder(input: {
  organizationId: string;
  orderId: string;
  session?: DemoSessionToken;
}) {
  const order = await transitionDemoOrder({
    organizationId: input.organizationId,
    orderId: input.orderId,
    actorRole: "DRIVER",
    nextStatus: "DELIVERED",
  });
  if (input.session) {
    await completeDemoScenarioStep({
      organizationId: input.organizationId,
      session: input.session,
      stepKey: "driver-deliver-order",
      metadata: { orderId: input.orderId },
    });
  }
  return order;
}

export async function runDemoCampaign(input: {
  organizationId: string;
}) {
  return recordBusinessEvent({
    organizationId: input.organizationId,
    type: "CAMPAIGN_CLICKED",
    entityType: "DemoCampaign",
    entityId: `demo-campaign-${randomUUID()}`,
    payload: { demoUniverse: true },
    metadata: { demoUniverse: true, externalProviderCalled: false },
  });
}
