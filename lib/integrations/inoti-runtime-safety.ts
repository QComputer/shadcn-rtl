import "server-only";

export function inotiLiveSmsAllowed() {
  return process.env.INOTI_ALLOW_LIVE_SMS === "true" && process.env.INOTI_RUNTIME_MUTATIONS_APPROVED === "true";
}

export function inotiLivePaymentsAllowed() {
  return process.env.INOTI_ALLOW_LIVE_PAYMENTS === "true" && process.env.INOTI_RUNTIME_MUTATIONS_APPROVED === "true";
}

export function inotiMutationSafetyState() {
  return {
    realSmsEnabled: false,
    realPaymentsEnabled: false,
    configuredSmsGate: inotiLiveSmsAllowed(),
    configuredPaymentGate: inotiLivePaymentsAllowed(),
  };
}
