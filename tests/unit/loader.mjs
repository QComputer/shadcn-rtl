import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { resolve as pathResolve } from "node:path";

const HERE = import.meta.dirname;
const ROOT = pathResolve(HERE, "..", "..");

const STUB_MAP = {
  "server-only": pathResolve(HERE, "stubs", "server-only.ts"),
  "@/lib/api-guards": pathResolve(HERE, "stubs", "api-guards.ts"),
  "@/lib/db": pathResolve(HERE, "stubs", "db.ts"),
  "@prisma/client": pathResolve(HERE, "stubs", "prisma-client.ts"),
};

export async function resolve(specifier, context, nextResolve) {
  if (Object.prototype.hasOwnProperty.call(STUB_MAP, specifier)) {
    return {
      url: pathToFileURL(STUB_MAP[specifier]).href,
      shortCircuit: true,
    };
  }

  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    const candidates = [
      pathResolve(ROOT, `${rel}.ts`),
      pathResolve(ROOT, `${rel}.mts`),
      pathResolve(ROOT, rel, "index.ts"),
      pathResolve(ROOT, rel, "index.mts"),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
        };
      }
    }
  }

  return nextResolve(specifier, context);
}
