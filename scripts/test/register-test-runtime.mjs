import { createRequire } from "node:module";

if (!process.env.NODE_ENV) process.env.NODE_ENV = "test";

const require = createRequire(import.meta.url);
const Module = require("module");

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad(request, parent, isMain);
};
