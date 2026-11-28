import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { validateLineage, CHECKPOINT, HISTORICAL } from "../../scripts/db/hotel-migration-lineage.mjs";
const names = readdirSync("prisma/migrations", { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name).sort();
test("exact checkpoints admit deterministic later migrations", () => { const x = validateLineage([...names, "20271201000000_future"]); assert.equal(x.preGap.at(-1), CHECKPOINT); assert.deepEqual(x.pending.slice(0, HISTORICAL.length), HISTORICAL); });
test("missing, reordered, duplicated and inserted historical migrations fail closed", () => { for (const mutate of [a => a.splice(a.indexOf(CHECKPOINT), 1), a => a.splice(a.indexOf(HISTORICAL[0]), 1), a => a.splice(a.indexOf(HISTORICAL[1]), 0, HISTORICAL[0]), a => a.splice(a.indexOf(HISTORICAL[1]), 0, "20261114135000_unexpected"), a => [a[0],a[1]]=[a[1],a[0]]]) { const a = [...names]; mutate(a); assert.throws(() => validateLineage(a)); } });
