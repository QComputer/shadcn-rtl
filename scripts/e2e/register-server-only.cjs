/* eslint-disable @typescript-eslint/no-require-imports -- Node --require preload must use CommonJS. */
const Module = require("node:module");

if (!process.env.NODE_ENV) process.env.NODE_ENV = "test";

const load = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }

  return load.apply(this, arguments);
};
