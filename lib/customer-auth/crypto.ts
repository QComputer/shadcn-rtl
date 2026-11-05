import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

function key(secret: string) {
  if (secret.length < 32) throw new Error("CUSTOMER_AUTH_SECRET_UNAVAILABLE");
  return createHmac("sha256", secret).update("bazarbaaz:customer-phone-auth:outbox:v1").digest();
}

export function createCustomerAccessToken() { return randomBytes(32).toString("base64url"); }
export function customerAuthDigest(value: string, secret: string) {
  key(secret);
  return createHmac("sha256", secret).update("bazarbaaz:customer-phone-auth:digest:v1\0").update(value).digest("hex");
}

export function encryptCustomerAuthPayload(payload: { phone: string; url: string }, secret: string, linkId: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), nonce);
  cipher.setAAD(Buffer.from(linkId));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptCustomerAuthPayload(value: string, secret: string, linkId: string) {
  const [version, nonce, tag, ciphertext, extra] = value.split(".");
  if (version !== "v1" || !nonce || !tag || !ciphertext || extra) throw new Error("INVALID_AUTH_PAYLOAD");
  const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(nonce, "base64url"));
  decipher.setAAD(Buffer.from(linkId));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const result: unknown = JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8"));
  if (!result || typeof result !== "object" || !("phone" in result) || !("url" in result) || typeof result.phone !== "string" || typeof result.url !== "string") throw new Error("INVALID_AUTH_PAYLOAD");
  return { phone: result.phone, url: result.url };
}
