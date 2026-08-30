export type InotiProductionReadinessInput = {
  schemaReady: boolean;
  appRevisionReady: boolean;
  integrationExists: boolean;
  integrationActive: boolean;
  providerIsInotiUssd: boolean;
  codeNamePresent: boolean;
  credentialsPresent: boolean;
  callbackValid: boolean;
  tenantPaymentEnabled: boolean;
  liveVerificationEnabled: boolean;
  livePaymentEnabled: boolean;
  runtimeMutationsApproved: boolean;
  monitoringReady: boolean;
  durableReconciliationReady: boolean;
};

export type InotiActivationState =
  | "NOT_CONFIGURED"
  | "CONFIGURED_DISABLED"
  | "VERIFICATION_READY"
  | "CANARY_ENABLED"
  | "ACTIVE"
  | "PAUSED";

export function evaluateInotiProductionReadiness(input: InotiProductionReadinessInput) {
  const configurationReady = input.integrationExists && input.integrationActive && input.providerIsInotiUssd &&
    input.codeNamePresent && input.credentialsPresent && input.callbackValid;
  const operationsReady = input.monitoringReady && input.durableReconciliationReady;
  const reconciliationEnabled = input.schemaReady && input.appRevisionReady && configurationReady &&
    input.liveVerificationEnabled && operationsReady;
  const initiationEnabled = reconciliationEnabled && input.tenantPaymentEnabled &&
    input.livePaymentEnabled && input.runtimeMutationsApproved;

  let activationState: InotiActivationState = "NOT_CONFIGURED";
  if (configurationReady) activationState = "CONFIGURED_DISABLED";
  if (reconciliationEnabled) activationState = "VERIFICATION_READY";
  if (initiationEnabled) activationState = "CANARY_ENABLED";
  if (configurationReady && !input.tenantPaymentEnabled && reconciliationEnabled) activationState = "PAUSED";

  const blockers: string[] = [];
  if (!input.schemaReady) blockers.push("SCHEMA");
  if (!input.appRevisionReady) blockers.push("APP_REVISION");
  if (!input.integrationExists || !input.integrationActive || !input.providerIsInotiUssd) blockers.push("INTEGRATION");
  if (!input.codeNamePresent) blockers.push("CODENAME");
  if (!input.credentialsPresent) blockers.push("CREDENTIALS");
  if (!input.callbackValid) blockers.push("CALLBACK");
  if (!input.monitoringReady || !input.durableReconciliationReady) blockers.push("OPERATIONS");
  if (!input.liveVerificationEnabled || !input.livePaymentEnabled || !input.runtimeMutationsApproved) blockers.push("GLOBAL_GATES");
  if (!input.tenantPaymentEnabled) blockers.push("PAYMENT_FLAG");

  const finalStatus = !input.schemaReady
    ? "BLOCKED_SCHEMA"
    : !input.integrationExists || !input.integrationActive || !input.providerIsInotiUssd || !input.credentialsPresent
      ? "BLOCKED_CONFIG"
      : !input.codeNamePresent
        ? "BLOCKED_PROVIDER"
        : !operationsReady
          ? "BLOCKED_OPERATIONS"
          : initiationEnabled
            ? "READY_FOR_CONTROLLED_ACTIVATION"
            : "BLOCKED_CONFIG";

  return {
    activationState,
    configurationReady,
    reconciliationEnabled,
    initiationEnabled,
    blockers: [...new Set(blockers)],
    finalStatus,
  } as const;
}
