export type InotiIntegrationConfig = {
  orderStatusEnabled: boolean;
  paymentEnabled: boolean;
};

export type ResolvedInotiIntegration = {
  id: string;
  publicId: string;
  organizationId: string;
  organizationSlug: string;
  status: "DRAFT" | "ACTIVE" | "DISABLED" | "REVOKED";
  codeName: string;
  credentialProfileKey: string | null;
  callbackOrigin: string | null;
  config: InotiIntegrationConfig;
};

export type ParsedUssdRequest = {
  mobile: string;
  sessionId: string;
  call: string;
  segments: string[];
  rrn: string | null;
};

export type UssdOrderProjection = {
  id: string;
  orderNumber: string;
  publicTrackingToken: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  totalToman: string;
  customerId: string | null;
  guestCustomerId: string | null;
  guestPhone: string | null;
};

export type UssdPaymentIntentProjection = {
  id: string;
  organizationId: string;
  integrationId: string;
  orderId: string;
  paymentRequestId: string | null;
  providerAttemptId: string | null;
  merchantFactorId: string;
  amountRial: bigint;
  sessionIdHash: string;
  mobileHash: string;
  mobileMasked: string;
  status: "REQUESTED" | "VERIFYING" | "VERIFIED" | "SETTLED" | "REJECTED";
  providerFactorId: string | null;
  rrn: string | null;
};

export type InotiPaymentVerificationQuery = {
  codeName: string;
  sessionId: string;
  mobile: string;
  amountRial: bigint;
  merchantFactorId: string;
  providerFactorId: string;
  rrn: string;
};

export type InotiPaymentRecord = {
  sessionId: string;
  mobile: string;
  amountRial: bigint;
  merchantFactorId: string;
  providerFactorId: string;
  rrn: string;
  result: string;
  successful: boolean;
};

export type InotiVerificationResult =
  | { ok: true; record: InotiPaymentRecord }
  | {
      ok: false;
      code: "NOT_READY" | "TIMEOUT" | "PROVIDER_ERROR" | "MALFORMED_RESPONSE" | "NOT_FOUND";
    };

export type InotiProviderReadiness = {
  ready: boolean;
  transportSecure: boolean;
  code:
    | "READY"
    | "CONFIG_DISABLED"
    | "MISSING_CREDENTIALS"
    | "MISSING_HASH_PEPPER"
    | "BLOCKED_INSECURE_PROVIDER_TRANSPORT"
    | "UNSUPPORTED_CREDENTIAL_PROFILE"
    | "CREDENTIAL_PROFILE_NOT_CONFIGURED";
};

export type InotiCredentialProfile = {
  organizationId: string;
  profileKey: string;
  username: string;
  password: string;
  endpoint: string;
  smsToken?: string | null;
  ussdCodeName?: string | null;
  ussdDialString?: string | null;
};

export interface InotiCredentialProvider {
  resolveProfile(organizationId: string, profileKey: string | null): Promise<InotiCredentialProfile | null>;
}

export interface UssdProvider {
  getReadiness(credentialProfile: InotiCredentialProfile | null): InotiProviderReadiness;
  verifyPayment(
    credentialProfile: InotiCredentialProfile | null,
    query: InotiPaymentVerificationQuery,
  ): Promise<InotiVerificationResult>;
}

export type PaymentSettlementInput = {
  integration: ResolvedInotiIntegration;
  intent: UssdPaymentIntentProjection;
  idempotencyKey: string;
  sessionIdHash: string;
  mobileHash: string;
  callHash: string;
  rrnHash: string;
  rrn: string;
  providerFactorId: string;
  providerResult: string;
};

export type PaymentNotification = {
  intentId: string;
  organizationId: string;
  orderId: string;
  orderNumber: string;
  previousStatus: string;
  customerId: string | null;
  guestCustomerId: string | null;
  guestPhone: string | null;
};

export type PaymentSettlementResult =
  | { kind: "SETTLED"; notification: PaymentNotification | null }
  | { kind: "DUPLICATE"; notification: null };

export interface UssdIntegrationRepository {
  resolveIntegration(publicId: string): Promise<ResolvedInotiIntegration | null>;
  touchIntegration(integrationId: string): Promise<void>;
  findOrderByTrackingToken(integration: ResolvedInotiIntegration, token: string): Promise<UssdOrderProjection | null>;
  createOrGetPaymentIntent(input: {
    integration: ResolvedInotiIntegration;
    order: UssdOrderProjection;
    sessionIdHash: string;
    mobileHash: string;
    mobileMasked: string;
    amountRial: bigint;
  }): Promise<UssdPaymentIntentProjection>;
  findPaymentIntent(integrationId: string, merchantFactorId: string): Promise<UssdPaymentIntentProjection | null>;
  recordCallbackEvent(input: {
    integration: ResolvedInotiIntegration;
    paymentIntentId?: string | null;
    idempotencyKey: string;
    sessionIdHash: string;
    mobileHash: string;
    callHash: string;
    rrnHash?: string | null;
    outcome: "ACCEPTED" | "REJECTED" | "DUPLICATE" | "FAILED";
    errorCode?: string | null;
  }): Promise<void>;
  markPaymentVerificationStarted(input: {
    integration: ResolvedInotiIntegration;
    intent: UssdPaymentIntentProjection;
    providerFactorId: string;
    rrn: string;
  }): Promise<void>;
  markPaymentVerificationFailed(input: {
    integration: ResolvedInotiIntegration;
    intent: UssdPaymentIntentProjection;
    reason: string;
  }): Promise<void>;
  settleVerifiedPayment(input: PaymentSettlementInput): Promise<PaymentSettlementResult>;
  markNotificationAttempted(intentId: string): Promise<void>;
}
