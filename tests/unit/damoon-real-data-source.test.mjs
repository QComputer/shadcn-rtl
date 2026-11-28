import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { validateSources } from "../../scripts/hotel/damoon-real-data-import.mjs";
const fixture = path.resolve("tests/fixtures/damoon-real-data-synthetic");
function copySource() {
 const dest=mkdtempSync(path.join(os.tmpdir(),"damoon-validation-"));
 for(const name of ["05-Units-Staging.json","06-Tariffs-Staging.json"]) writeFileSync(path.join(dest,name),readFileSync(path.join(fixture,name)));
 return dest;
}
test("unit and tariff source schemas reject duplicate or unsupported entries",()=>{
 let dir=copySource(), file=path.join(dir,"05-Units-Staging.json"), data=JSON.parse(readFileSync(file,"utf8"));
 data.units[1].unit_code=data.units[0].unit_code; writeFileSync(file,JSON.stringify(data)); assert.throws(()=>validateSources(dir));
 dir=copySource(); file=path.join(dir,"06-Tariffs-Staging.json"); data=JSON.parse(readFileSync(file,"utf8")); data.tariffs[0].category="unknown"; writeFileSync(file,JSON.stringify(data)); assert.throws(()=>validateSources(dir));
 dir=copySource(); file=path.join(dir,"05-Units-Staging.json"); data=JSON.parse(readFileSync(file,"utf8")); data.units[0].publication_allowed=true; writeFileSync(file,JSON.stringify(data)); assert.throws(()=>validateSources(dir));
});
test("non-divisible IRR tariffs remain exact and cannot be activated",()=>{
 const parsed=validateSources(fixture); assert.equal(parsed.units.units.length,31); assert.equal(parsed.tariffs.tariffs.length,8);
 for (const row of parsed.tariffIntegrations) { assert.equal(row.activationAllowed,false); if (BigInt(row.amountIRR)%10n) assert.equal(row.amountToman,null); }
});
