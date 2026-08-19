import { readFileSync } from "fs";
import { join } from "path";
import type { ExtractionFixture } from "./types";
import { FIXTURE_FILENAME } from "./constants";

const FIXTURE_PATH = join(
  process.cwd(),
  "prisma",
  "seed-data",
  FIXTURE_FILENAME,
);

export function readExtractionFixture(): ExtractionFixture {
  const raw = readFileSync(FIXTURE_PATH, "utf8");
  return JSON.parse(raw) as ExtractionFixture;
}

export { SICILY_DOMAIN } from "./constants";
