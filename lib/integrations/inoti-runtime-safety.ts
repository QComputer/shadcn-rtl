import "server-only";

export function inotiLiveSmsAllowed() {
  return process.env.INOTI_ALLOW_LIVE_SMS === "true" && process.env.INOTI_RUNTIME_MUTATIONS_APPROVED === "true";
}

export function inotiLivePaymentsAllowed() {
  return process.env.INOTI_ALLOW_LIVE_PAYMENTS === "true" && process.env.INOTI_RUNTIME_MUTATIONS_APPROVED === "true";
}

/**
 * Allows only the hosted acceptance fixture to advertise a loopback-backed
 * simulated provider. This never authorizes provider initiation or settlement.
 */
export function inotiAcceptanceSimulationAllowed() {
  return process.env.CI === "true" &&
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.INOTI_USSD_ACCEPTANCE_SIMULATION === "true" &&
    !inotiLivePaymentsAllowed();
}

export function inotiMutationSafetyState() {
  return {
    realSmsEnabled: false,
    realPaymentsEnabled: false,
    configuredSmsGate: inotiLiveSmsAllowed(),
    configuredPaymentGate: inotiLivePaymentsAllowed(),
  };
}
