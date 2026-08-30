import "server-only";

import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-guards";
import prisma from "@/lib/db";
import { normalizeIranianMobile } from "@/lib/integrations/inoti-ussd/parser";
import { hashInotiEvidence, maskInotiMobile } from "@/lib/integrations/inoti-ussd/evidence";
import { tomanToInotiRial } from "@/lib/integrations/inoti-ussd/currency";
import type { InotiCredentialProvider, UssdProvider } from "@/lib/integrations/inoti-ussd/types";
import type { UssdIntegrationRepository } from "@/lib/integrations/inoti-ussd/repository";
import { inotiLivePaymentsAllowed } from "@/lib/integrations/inoti-runtime-safety";

type DbClient = Prisma.TransactionClient | typeof prisma;

export class InotiPaymentLifecycleService {
  constructor(
    private readonly repository: UssdIntegrationRepository,
    private readonly provider: UssdProvider,
    private readonly credentialProvider: InotiCredentialProvider,
    private readonly initiationAllowed: () => boolean = inotiLivePaymentsAllowed,
    private readonly db: DbClient = prisma,
  ) {}

  async initiate(input: {
    publicIntegrationId: string;
    organizationId: string;
    paymentRequestId: string;
    sessionId: string;
    mobile: string;
  }) {
    if (!this.initiationAllowed()) throw new ApiError(403, "Live payment initiation is disabled");
    const integration = await this.repository.resolveIntegration(input.publicIntegrationId);
    if (!integration || integration.status !== "ACTIVE" || integration.organizationId !== input.organizationId) {
      throw new ApiError(404, "Payment integration not found");
    }
    if (!integration.config.paymentEnabled) throw new ApiError(403, "Payment is disabled for organization");

    const mobile = normalizeIranianMobile(input.mobile);
    if (!mobile) throw new ApiError(400, "Invalid mobile");
    const sessionId = input.sessionId.trim();
    if (!/^(?:\d{1,64}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(sessionId)) {
      throw new ApiError(400, "Invalid session");
    }

    const profile = await this.credentialProvider.resolveProfile(integration.organizationId, integration.credentialProfileKey);
    if (!this.provider.getReadiness(profile).ready) throw new ApiError(503, "Payment provider is unavailable");

    const request = await this.db.paymentRequest.findFirst({
      where: {
        id: input.paymentRequestId,
        organizationId: integration.organizationId,
        providerIntegrationId: integration.id,
        currency: "TOMAN",
      },
      select: { id: true, amountToman: true, status: true },
    });
    if (!request) throw new ApiError(404, "Payment request not found");
    if (!["CREATED", "AWAITING_CUSTOMER", "PENDING_VERIFICATION"].includes(request.status)) {
      throw new ApiError(409, "Payment request is not initiable");
    }

    const intent = await this.repository.createOrGetPaymentIntent({
      integration,
      paymentRequestId: request.id,
      sessionIdHash: hashInotiEvidence(sessionId),
      mobileHash: hashInotiEvidence(mobile),
      mobileMasked: maskInotiMobile(mobile),
      amountToman: request.amountToman,
    });
    const amountRial = tomanToInotiRial(request.amountToman);
    if (intent.amountRial !== amountRial) throw new ApiError(409, "Provider amount mismatch");
    return {
      paymentRequestId: request.id,
      providerAttemptId: intent.providerAttemptId,
      merchantFactorId: intent.merchantFactorId,
      amountToman: request.amountToman,
      amountRial,
      payload: `9900|${intent.merchantFactorId}|${amountRial.toString()}`,
    };
  }
}
