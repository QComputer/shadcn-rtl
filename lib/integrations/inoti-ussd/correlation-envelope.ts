import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const PURPOSE = "INOTI_PAYMENT_VERIFICATION_V1";

export type DurablePaymentCorrelation = {
  sessionId: string;
  mobile: string;
  call: string;
  rrn: string;
  merchantFactorId: string;
  providerFactorId: string;
};

export type CorrelationEnvelope = {
  v: 1;
  alg: "A256GCM";
  purpose: typeof PURPOSE;
  keyVersion: number;
  iv: string;
  ciphertext: string;
  tag: string;
};

function keyEnvironmentName(version: number) {
  return `INOTI_PAYMENT_CORRELATION_KEY_V${version}`;
}

function decodeKey(encoded: string | undefined) {
  if (!encoded) throw new Error("INOTI_PAYMENT_CORRELATION_KEY_MISSING");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("INOTI_PAYMENT_CORRELATION_KEY_INVALID");
  return key;
}

export function activeCorrelationKeyVersion(env: NodeJS.ProcessEnv = process.env) {
  const version = Number(env.INOTI_PAYMENT_CORRELATION_ACTIVE_KEY_VERSION ?? "1");
  if (!Number.isSafeInteger(version) || version < 1 || version > 999) {
    throw new Error("INOTI_PAYMENT_CORRELATION_KEY_VERSION_INVALID");
  }
  return version;
}

function aad(context: { organizationId: string; integrationId: string; paymentIntentId: string }) {
  return Buffer.from(`${PURPOSE}\0${context.organizationId}\0${context.integrationId}\0${context.paymentIntentId}`, "utf8");
}

export function correlationFingerprint(value: DurablePaymentCorrelation, env: NodeJS.ProcessEnv = process.env) {
  const version = activeCorrelationKeyVersion(env);
  return createHmac("sha256", decodeKey(env[keyEnvironmentName(version)]))
    .update(`${PURPOSE}\0FINGERPRINT\0`, "utf8")
    .update(JSON.stringify([value.sessionId, value.mobile, value.call, value.rrn, value.merchantFactorId, value.providerFactorId]))
    .digest("hex");
}

export function encryptPaymentCorrelation(
  value: DurablePaymentCorrelation,
  context: { organizationId: string; integrationId: string; paymentIntentId: string },
  env: NodeJS.ProcessEnv = process.env,
): CorrelationEnvelope {
  const keyVersion = activeCorrelationKeyVersion(env);
  const key = decodeKey(env[keyEnvironmentName(keyVersion)]);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aad(context));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return {
    v: 1,
    alg: "A256GCM",
    purpose: PURPOSE,
    keyVersion,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptPaymentCorrelation(
  envelope: CorrelationEnvelope,
  context: { organizationId: string; integrationId: string; paymentIntentId: string },
  env: NodeJS.ProcessEnv = process.env,
): DurablePaymentCorrelation {
  if (envelope.v !== 1 || envelope.alg !== "A256GCM" || envelope.purpose !== PURPOSE) {
    throw new Error("INOTI_PAYMENT_CORRELATION_ENVELOPE_UNSUPPORTED");
  }
  const key = decodeKey(env[keyEnvironmentName(envelope.keyVersion)]);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(envelope.iv, "base64"));
  decipher.setAAD(aad(context));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
  const value = JSON.parse(plaintext) as DurablePaymentCorrelation;
  if (!value.sessionId || !value.mobile || !value.call || !value.rrn || !value.merchantFactorId || !value.providerFactorId) {
    throw new Error("INOTI_PAYMENT_CORRELATION_ENVELOPE_INVALID");
  }
  return value;
}

export function correlationKeyReadiness(env: NodeJS.ProcessEnv = process.env) {
  try {
    const version = activeCorrelationKeyVersion(env);
    decodeKey(env[keyEnvironmentName(version)]);
    return { configured: true, activeVersion: version };
  } catch {
    return { configured: false, activeVersion: null };
  }
}
