import { createRequire } from "node:module";

if (!process.env.NODE_ENV) process.env.NODE_ENV = "test";
if (process.env.NODE_ENV === "test" && !process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER) {
  process.env.AI_MEDIA_APPLICATION_STORAGE_ADAPTER = "local-test";
}

const require = createRequire(import.meta.url);
const Module = require("module");

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad(request, parent, isMain);
};
