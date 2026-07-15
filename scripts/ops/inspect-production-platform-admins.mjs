import "dotenv/config"
import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DIRECT_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL is not set")
  process.exit(1)
}

const sql = neon(databaseUrl)

function mask(value, visibleChars = 3) {
  if (!value || typeof value !== "string") return "***"
  if (value.length <= visibleChars) return "***"
  return value.slice(0, visibleChars) + "***"
}

async function main() {
  console.log("Querying production SUPER_ADMIN accounts (read-only)...")

  const users = await sql`
    SELECT
      id,
      name,
      email,
      phone,
      role,
      "isActive",
      "isTeamMember",
      "failedLoginAttempts",
      "lockedUntil",
      "lastLoginAt",
      "createdAt",
      "updatedAt",
      "deletedAt"
    FROM "User"
    WHERE "deletedAt" IS NULL
      AND role = 'SUPER_ADMIN'
    ORDER BY "createdAt"
  `

  console.log(`SUPER_ADMIN accounts found: ${users.length}`)
  console.log("")

  for (const user of users) {
    const loginIdentifier = user.email || user.phone || user.name || "unknown"
    const maskedLogin = mask(loginIdentifier)
    const isActive = user.isActive ?? true
    const isLocked = user.lockedUntil && new Date(user.lockedUntil) > new Date()

    console.log(`- id: ${user.id}`)
    console.log(`  login: ${maskedLogin}`)
    console.log(`  role: ${user.role}`)
    console.log(`  enabled: ${isActive ? "yes" : "no"}`)
    if (isLocked) {
      console.log(`  locked: yes (until ${user.lockedUntil})`)
    }
    if (user.lastLoginAt) {
      console.log(`  lastLoginAt: ${user.lastLoginAt}`)
    }
    console.log("")
  }

  if (users.length === 0) {
    console.log("No SUPER_ADMIN accounts found.")
    console.log("Explicit authorization is required before creating a platform administrator.")
  } else if (users.some((u) => !u.isActive)) {
    console.log("At least one SUPER_ADMIN account is disabled.")
    console.log("Explicit authorization is required before enabling or replacing it.")
  } else {
    console.log("Active SUPER_ADMIN accounts exist.")
    console.log("Credentials are required to proceed with authenticated production verification.")
  }
}

main().catch((e) => {
  console.error("Inventory failed:", e.message)
  process.exit(1)
})
