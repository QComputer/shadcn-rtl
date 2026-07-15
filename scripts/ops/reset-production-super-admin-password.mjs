/**
 * One-time password reset for an existing production SUPER_ADMIN account.
 *
 * Required env:
 *   PLATFORM_ADMIN_PASSWORD_RESET_ENABLED=true
 *   PLATFORM_ADMIN_PASSWORD_RESET_ACK=I_AUTHORIZE_PRODUCTION_SUPER_ADMIN_PASSWORD_RESET
 *   PLATFORM_ADMIN_TARGET_ID=<exact existing SUPER_ADMIN account id>
 *   PLATFORM_ADMIN_NEW_PASSWORD=<strong temporary password>
 *
 * Behavior:
 *   - Hashes the new password with bcrypt 12 rounds (canonical project hashing).
 *   - Updates only the specified SUPER_ADMIN account.
 *   - Clears failedLoginAttempts and lockedUntil.
 *   - Does not create new accounts.
 *   - Does not print the password or hash.
 *   - Leaves reset gates disabled after execution.
 */

import "dotenv/config"
import { neon } from "@neondatabase/serverless"
import bcrypt from "bcryptjs"

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DIRECT_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL is not set")
  process.exit(1)
}

const sql = neon(databaseUrl)

function fail(message) {
  console.error("ERROR:", message)
  process.exit(1)
}

async function main() {
  const enabled = process.env.PLATFORM_ADMIN_PASSWORD_RESET_ENABLED
  const ack = process.env.PLATFORM_ADMIN_PASSWORD_RESET_ACK
  const targetId = process.env.PLATFORM_ADMIN_TARGET_ID
  const newPassword = process.env.PLATFORM_ADMIN_NEW_PASSWORD

  if (enabled !== "true") {
    fail("PLATFORM_ADMIN_PASSWORD_RESET_ENABLED is not true. Refusing to run.")
  }

  if (ack !== "I_AUTHORIZE_PRODUCTION_SUPER_ADMIN_PASSWORD_RESET") {
    fail("PLATFORM_ADMIN_PASSWORD_RESET_ACK does not match required authorization string.")
  }

  if (!targetId || typeof targetId !== "string" || targetId.trim().length === 0) {
    fail("PLATFORM_ADMIN_TARGET_ID is required.")
  }

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    fail("PLATFORM_ADMIN_NEW_PASSWORD is required and must be at least 6 characters.")
  }

  console.log("Looking up target SUPER_ADMIN account...")

  const users = await sql`
    SELECT id, name, email, phone, role, "isActive"
    FROM "User"
    WHERE id = ${targetId}
      AND "deletedAt" IS NULL
      AND role = 'SUPER_ADMIN'
  `

  if (users.length === 0) {
    fail("No SUPER_ADMIN account found with the specified target ID.")
  }

  const target = users[0]
  if (!target.isActive) {
    fail("Target SUPER_ADMIN account is disabled. Refusing to reset password for a disabled account.")
  }

  console.log("Target account found. Hashing new password with bcrypt 12 rounds (canonical project hashing)...")

  const passwordHash = await bcrypt.hash(newPassword, 12)

  console.log("Updating password and clearing login locks...")

  await sql`
    UPDATE "User"
    SET
      password = ${passwordHash},
      "failedLoginAttempts" = 0,
      "lockedUntil" = NULL,
      "updatedAt" = NOW()
    WHERE id = ${targetId}
  `

  console.log("OK: Password reset completed for SUPER_ADMIN account.")
  console.log(`Target ID: ${targetId}`)
  console.log("Next step: run the read-only deployed P10 smoke with the new credentials.")

  const remainingEnvVars = [
    "PLATFORM_ADMIN_PASSWORD_RESET_ENABLED",
    "PLATFORM_ADMIN_PASSWORD_RESET_ACK",
    "PLATFORM_ADMIN_TARGET_ID",
    "PLATFORM_ADMIN_NEW_PASSWORD",
  ]
  console.log("")
  console.log("Remove these environment variables after use:")
  for (const name of remainingEnvVars) {
    console.log(`  - ${name}`)
  }
}

main().catch((e) => {
  console.error("Password reset failed:", e.message)
  process.exit(1)
})
