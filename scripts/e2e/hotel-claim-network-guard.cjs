/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Next process preload. */
"use strict";
const net = require("node:net");
const expected = new URL(process.env.DATABASE_URL || "http://invalid");
if (process.env.NODE_ENV !== "development" || expected.hostname !== "127.0.0.1" || expected.port !== "55439" || expected.pathname !== "/retail_hero_test" || expected.username !== "hero_test" || process.env.DATABASE_URL !== process.env.DIRECT_URL) throw new Error("SYNTHETIC_NETWORK_GUARD_ENV_INVALID");
const original = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (typeof first === "string" && !/^\d+$/.test(first)) return original.apply(this, args);
  const options = typeof first === "object" && first !== null ? first : { port: first, host: args[1] };
  if (options.path) return original.apply(this, args);
  const host = options.host || options.hostname || "localhost";
  if (!["127.0.0.1", "::1", "localhost"].includes(host) && !String(host).endsWith(".localhost")) {
    queueMicrotask(() => this.destroy(Object.assign(new Error("SYNTHETIC_EXTERNAL_NETWORK_BLOCKED"), { code: "SYNTHETIC_EXTERNAL_NETWORK_BLOCKED" })));
    return this;
  }
  return original.apply(this, args);
};
