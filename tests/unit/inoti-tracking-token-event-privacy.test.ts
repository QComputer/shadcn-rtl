import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  InotiCredentialProvider,
  ResolvedInotiIntegration,
  UssdIntegrationRepository,
  UssdProvider,
} from "@/lib/integrations/inoti-ussd/types";

// A placeholder URL lets Prisma construct its lazy client during module import;
// this unit test injects every repository operation and never connects to it.
process.env.DATABASE_URL ??= "postgresql://unit-test.invalid/unused";

const integration: ResolvedInotiIntegration = {
  id: "integration-a",
  publicId: "11111111-1111-4111-8111-111111111111",
  organizationId: "tenant-a",
  organizationSlug: "tenant-a",
  status: "ACTIVE",
  codeName: "alpha",
  credentialProfileKey: "test-profile",
  callbackOrigin: null,
  config: { orderStatusEnabled: true, paymentEnabled: true },
};

test("USSD_PAYMENT_SELECTED records only tracking-token metadata, never the bearer", async () => {
  const { InotiUssdWorkflow } = await import("@/lib/integrations/inoti-ussd/workflow");
  const rawTrackingToken = "raw-order-tracking-token-sentinel";
  const events: Array<{ eventType: string; metadata?: unknown }> = [];
  const repository = {
    resolveIntegration: async () => integration,
    touchIntegration: async () => undefined,
    findUssdSession: async () => null,
    touchUssdSession: async () => undefined,
    recordUssdEvent: async (event: { eventType: string; metadata?: unknown }) => { events.push(event); },
    findOrderByTrackingToken: async () => ({
      id: "order-a",
      orderNumber: "RET-ORDER-A",
      publicTrackingToken: rawTrackingToken,
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: "INOTI_USSD",
      totalToman: "1250",
      customerId: "customer-a",
      guestCustomerId: null,
      guestPhone: null,
      organizationId: "tenant-a",
    }),
    createOrGetPaymentIntent: async () => ({
      id: "intent-a",
      status: "CREATED",
      amountRial: BigInt(12_500),
      merchantFactorId: "factor-a",
    }),
  } as unknown as UssdIntegrationRepository;
  const provider = {
    getReadiness: () => ({ ready: true }),
  } as unknown as UssdProvider;
  const credentials = {
    resolveProfile: async () => ({
      organizationId: "tenant-a",
      profileKey: "test-profile",
      username: "test-user",
      password: "test-password",
      endpoint: "https://provider.example.test/payments",
      ussdCodeName: "alpha",
    }),
  } as unknown as InotiCredentialProvider;
  const workflow = new InotiUssdWorkflow(repository, provider, credentials, async () => undefined);

  const response = await workflow.handle(integration.publicId, null, new URLSearchParams({
    mobile: "09123456789",
    sessionid: "123456",
    call: `6655*alpha*2*${rawTrackingToken}`,
  }));

  const paymentSelected = events.find((event) => event.eventType === "USSD_PAYMENT_SELECTED");
  assert.ok(paymentSelected, `unexpected workflow result ${response}; recorded events: ${events.map((event) => `${event.eventType}:${JSON.stringify(event.metadata)}`).join(";")}`);
  assert.deepEqual(paymentSelected.metadata, {
    trackingTokenPresent: true,
    trackingTokenLength: rawTrackingToken.length,
  });
  assert.doesNotMatch(JSON.stringify(events), new RegExp(rawTrackingToken));
});
