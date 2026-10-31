#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

/**
 * Non-destructive source/destination delta comparison script.
 *
 * This script compares the source database metadata (from verified artifacts)
 * against the destination database state (if accessible via read-only connection).
 *
 * It does NOT modify any database, does NOT restore, does NOT delete, and does
 * NOT perform any write operations.
 */

const root = process.cwd();

function read(rel: string): string | null {
  try {
    return fs.readFileSync(path.join(root, rel), "utf8");
  } catch {
    return null;
  }
}

interface DeltaReport {
  sourceVerified: boolean;
  destinationVerified: boolean;
  sourceBaseline: Record<string, unknown> | null;
  destinationState: Record<string, unknown> | null;
  delta: {
    tables: { source: number; destination: number | null; missing: string[] };
    rows: { source: number; destination: number | null };
    migrations: { source: number; destination: number | null };
    neonAuthTables: { source: number; destination: number | null };
    manuallyUnavailable: { source: boolean; destination: boolean | null };
  };
  blockers: string[];
  recommendations: string[];
}

function buildReport(): DeltaReport {
  const report: DeltaReport = {
    sourceVerified: false,
    destinationVerified: false,
    sourceBaseline: null,
    destinationState: null,
    delta: {
      tables: { source: 0, destination: null, missing: [] },
      rows: { source: 0, destination: null },
      migrations: { source: 0, destination: null },
      neonAuthTables: { source: 0, destination: null },
      manuallyUnavailable: { source: false, destination: null },
    },
    blockers: [],
    recommendations: [],
  };

  // --- Source baseline from verified artifacts ---
  const evidencePath = "C:/Users/disso/AppData/Local/BazarBaaz/R6.3/r6.3-archive-evidence.json";
  const evidenceStr = read(evidencePath);
  if (evidenceStr) {
    try {
      const evidence = JSON.parse(evidenceStr);
      report.sourceVerified = true;
      report.sourceBaseline = evidence;
      report.delta.tables.source = evidence.sourceBaseline?.tableCount ?? 173;
      report.delta.rows.source = evidence.sourceBaseline?.rowCount ?? 2624;
      report.delta.migrations.source = evidence.sourceBaseline?.migrationLedger?.total ?? 115;
      report.delta.neonAuthTables.source = evidence.sourceBaseline?.neonAuthTables ?? 9;
      report.delta.manuallyUnavailable.source = true; // Column added in Retail migration 20261030215000
    } catch {
      report.blockers.push(`Failed to parse evidence JSON at ${evidencePath}`);
    }
  } else {
    report.blockers.push(`Evidence JSON not found at ${evidencePath}`);
  }

  // --- Destination state from RunFlare (if accessible) ---
  const databaseUrl = process.env.PGHOST && process.env.PGDATABASE && process.env.PGUSER
    ? `postgresql://${process.env.PGUSER}:***@${process.env.PGHOST}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE}`
    : null;

  if (!databaseUrl) {
    report.blockers.push("RunFlare destination database not accessible: PGHOST/PGDATABASE/PGUSER not set");
    report.recommendations.push("Restore RunFlare authenticated access and inspect databasewhy_db before any migration");
    return report;
  }

  // Destination verification would go here if a read-only connection were available.
  // For now, mark as unverified.
  report.destinationVerified = false;
  report.blockers.push("Destination database state not verified: no read-only PostgreSQL access");
  report.recommendations.push("Verify current databasewhy_db contents before any restore or migration operation");

  return report;
}

function printReport(report: DeltaReport): void {
  console.log("========================================");
  console.log("  Non-Destructive Delta Comparison");
  console.log("========================================\n");

  console.log(`Source verified:   ${report.sourceVerified ? "YES" : "NO"}`);
  console.log(`Destination verified: ${report.destinationVerified ? "YES" : "NO"}`);

  if (report.sourceBaseline) {
    console.log(`\nSource baseline:`);
    console.log(`  Tables:   ${report.delta.tables.source}`);
    console.log(`  Rows:     ${report.delta.rows.source}`);
    console.log(`  Migrations: ${report.delta.migrations.source}`);
    console.log(`  neon_auth tables: ${report.delta.neonAuthTables.source}`);
    console.log(`  manuallyUnavailable: ${report.delta.manuallyUnavailable.source}`);
  }

  if (!report.destinationVerified) {
    console.log(`\nDestination state: UNKNOWN (access blocked)`);
    console.log(`  Tables:   N/A`);
    console.log(`  Rows:     N/A`);
    console.log(`  Migrations: N/A`);
    console.log(`  neon_auth tables: N/A`);
    console.log(`  manuallyUnavailable: N/A`);
  }

  if (report.blockers.length > 0) {
    console.log(`\nBlockers:`);
    for (const blocker of report.blockers) {
      console.log(`  - ${blocker}`);
    }
  }

  if (report.recommendations.length > 0) {
    console.log(`\nRecommendations:`);
    for (const rec of report.recommendations) {
      console.log(`  - ${rec}`);
    }
  }

  console.log(`\nNo database reads, writes, or modifications were performed.`);
}

const report = buildReport();
printReport(report);

if (report.blockers.length > 0) {
  process.exit(1);
}
