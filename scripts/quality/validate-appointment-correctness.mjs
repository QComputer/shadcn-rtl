#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function add(name, ok, detail = "") {
  results.push({ name, ok, detail });
}

const appointmentServicePath = "lib/services/appointment.service.ts";
const appointmentService = read(appointmentServicePath);

add(
  "business-hour resolver exists",
  /async function findApplicableBusinessHours\(/.test(appointmentService),
);
add(
  "create/reschedule business-window assertion exists",
  /async function assertAppointmentFitsBusinessWindow\(/.test(appointmentService),
);
add(
  "buffered conflict helper exists",
  /function buildGuardedAppointmentWindow\(/.test(appointmentService),
);
add(
  "create path enforces business hours before conflict check",
  /await assertAppointmentFitsBusinessWindow\(\s*tx,[\s\S]*?const \{ guardedStart, guardedEnd \} = buildGuardedAppointmentWindow\(\s*startTime,\s*endTime,\s*bookingSettings,\s*\);[\s\S]*?buildConflictWhere\(scope, guardedStart, guardedEnd\)/.test(appointmentService),
);
add(
  "reschedule path enforces business hours before conflict check",
  /await assertAppointmentFitsBusinessWindow\(\s*prisma,[\s\S]*?const \{ guardedStart, guardedEnd \} = buildGuardedAppointmentWindow\(\s*newStart,\s*clampedEnd,\s*bookingSettings,\s*\);[\s\S]*?buildConflictWhere\(scope, guardedStart, guardedEnd\)/.test(appointmentService),
);
add(
  "slot generation shares business-hour resolver",
  /const businessHours = await findApplicableBusinessHours\(\s*prisma,\s*service,\s*dateOnly,\s*timezone,\s*\);/.test(appointmentService),
);
add(
  "appointment outside-hours error is explicit",
  appointmentService.includes("Appointment is outside available business hours"),
);

const packageJson = JSON.parse(read("package.json"));
add(
  "package script quality:appointment-correctness exists",
  packageJson.scripts?.["quality:appointment-correctness"] === "node scripts/quality/validate-appointment-correctness.mjs",
);

const validateProject = read("scripts/quality/validate-project.mjs");
add(
  "aggregate project validator includes appointment validator file",
  validateProject.includes("scripts/quality/validate-appointment-correctness.mjs"),
);
add(
  "aggregate project validator runs appointment correctness validator",
  validateProject.includes("P26 appointment correctness validator passes"),
);

console.table(results);
const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`Appointment correctness validation failed with ${failed.length} issue(s).`, failed);
  process.exit(1);
}

console.log("Appointment correctness validation passed.");
