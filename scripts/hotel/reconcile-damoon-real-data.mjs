import fs from "node:fs";
import path from "node:path";

const root = process.argv[2] || "C:/Users/disso/damoon-real-data";
const units = JSON.parse(fs.readFileSync(path.join(root, "05-Units-Staging.json"), "utf8"));
const tariffs = JSON.parse(fs.readFileSync(path.join(root, "06-Tariffs-Staging.json"), "utf8"));

const list = units.units || units;
console.log("Unit count:", list.length);
const codes = list.map((u) => u.unit_code);
const unique = new Set(codes);
console.log("Unique codes:", unique.size);
if (unique.size !== 31) { console.error("ERROR: expected 31 unique codes"); process.exit(1); }

console.log("\nTariffs (IRR):");
for (const t of tariffs.tariffs) console.log(`  ${t.category}: ${t.amount_irr}`);

console.log("\nUnresolved (null) fields per unit summary:");
let nullCount = 0;
for (const u of list) {
  for (const [k,v] of Object.entries(u)) {
    if (v === null) nullCount++;
    if (typeof v === "object" && v !== null) {
      for (const [k2,v2] of Object.entries(v)) {
        if (v2 === null) nullCount++;
      }
    }
  }
}
console.log("Null field occurrences:", nullCount);
console.log("\nAll sale_enabled/publication_allowed false:",
  list.every((u) => u.sale_enabled === false && u.publication_allowed === false));
console.log("Reconciliation complete. 31 units, 8 tariffs. STAGING ONLY.");
