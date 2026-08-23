import path from "node:path";
import dotenv from "dotenv";

let loaded = false;

export function ensureNextLocalEnvLoaded() {
  if (loaded) return;
  loaded = true;

  dotenv.config({
    path: path.join(process.cwd(), ".env.local"),
    override: false,
    quiet: true,
  });
}
