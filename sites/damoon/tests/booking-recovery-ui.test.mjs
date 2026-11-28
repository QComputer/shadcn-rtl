import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../booking.js", import.meta.url), "utf8");

test("booking UI opt-in is explicit and recovery credential is one-time/export-only", () => {
  assert.match(source, /data-recovery-opt-in/);
  assert.match(source, /recoveryOptIn\s*=\s*Boolean\(slot\.querySelector\("\[data-recovery-opt-in\]"\)\?\.checked\)/);
  assert.match(source, /\.\.\.\(recoveryOptIn\s*\?\s*\{\s*recoveryOptIn:\s*true\s*\}\s*:\s*\{\}\)/);
  assert.match(source, /data-export-recovery/);
  assert.match(source, /link\.download\s*=\s*"reservation-recovery\.txt"/);
  assert.match(source, /flow\.hold\?\.reservation\?\.recoveryCredential/);
  assert.doesNotMatch(source, /(?:localStorage|sessionStorage)\.(?:setItem|set)\([^\n]*(?:credential|recovery)/i);
  assert.doesNotMatch(source, /(?:localStorage|sessionStorage)[^\n]*(?:recoveryCredential|recoveryCredential)/i);
});
