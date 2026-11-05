import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import { NextRequest } from "next/server";

type SettingsRow = { id: string; organizationSlug: string; settings: Record<string, unknown> | null; [key: string]: unknown };
const session: { user: { id: string } } | null = { user: { id: "manager-1" } };
let row: SettingsRow = {
  id: "settings-1",
  organizationSlug: "sample",
  settings: {
    theme: "dark",
    oldNonReserved: { keepOnlyUntilReplacement: true },
    retailHeroPublication: { revisionId: "revision-live", previousRevisionId: null, publishedAt: "2026-11-02T00:00:00.000Z" },
  },
};
const rawCalls: Array<{ sql: string; values: unknown[] }> = [];
const upserts: Array<{ update: Record<string, unknown>; create: Record<string, unknown> }> = [];
const auditCalls: unknown[] = [];

class TestApiError extends Error { constructor(public status: number, message: string) { super(message); } }

mock.module("next/cache", { namedExports: { revalidatePath: () => undefined } });
mock.module("@/lib/db", { namedExports: {
  prisma: {
    organization: {
      findUnique: async ({ select }: { select: Record<string, unknown> }) => Object.hasOwn(select, "slug")
        ? { slug: "sample" }
        : { capabilities: [{ key: "SHOP", status: "ACTIVE" }], settings: { brandLandingProvider: null } },
    },
    organizationSettings: { findUnique: async () => row },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      organizationSettings: {
        upsert: async ({ update, create }: { update: Record<string, unknown>; create: Record<string, unknown> }) => {
          upserts.push({ update, create });
          row = { ...row, ...update, organizationSlug: "sample" };
          return row;
        },
        findUniqueOrThrow: async () => row,
      },
      $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join("?");
        rawCalls.push({ sql, values });
        if (values.includes("retailHeroPublication")) {
          const incoming = JSON.parse(String(values[0])) as Record<string, unknown>;
          const publication = row.settings?.retailHeroPublication;
          row = { ...row, settings: { ...incoming, ...(publication === undefined ? {} : { retailHeroPublication: publication }) } };
        } else if (sql.includes("defaultPublicCapability")) {
          row = { ...row, settings: { ...(row.settings ?? {}), defaultPublicCapability: values[0] } };
        }
        return 1;
      },
    }),
  },
} });
mock.module("@/lib/validators", { namedExports: {
  updateOrganizationSettingsSchema: { parse: (input: unknown) => input },
  updatePreparationDefaultsSchema: { parse: (input: unknown) => input },
} });
mock.module("@/lib/api-guards", { namedExports: {
  ApiError: TestApiError,
  jsonError: (error: unknown, fallback: string) => Response.json({ error: error instanceof Error ? error.message : fallback }, { status: error instanceof TestApiError ? error.status : 500 }),
  requireAuthSession: async () => { if (!session) throw new TestApiError(401, "Unauthorized"); return session; },
  requireSameOriginMutation: (request: Request) => { if (request.headers.get("origin") !== new URL(request.url).origin) throw new TestApiError(403, "Cross-origin request rejected"); },
  resolveManageableOrganizationId: async (_session: unknown, id: string) => id,
} });
mock.module("@/lib/audit-log", { namedExports: { writeAuditLog: async (input: unknown) => { auditCalls.push(input); } } });
mock.module("@/lib/organization-public-home", { namedExports: {
  activePublicBusinessCapabilities: (capabilities: unknown) => capabilities,
  assertDefaultPublicCapabilityAllowed: () => undefined,
  assertPublicHomeModeAllowed: () => undefined,
  isPublicBusinessCapability: (value: unknown) => value === "SHOP" || value === "APPOINTMENT",
} });
mock.module("@/lib/custom-domain-routing", { namedExports: {
  buildOrganizationPublicPath: () => "/public",
  buildOrganizationRootPath: () => "/",
} });

let PUT: typeof import("../../../app/api/organizations/[id]/settings/route").PUT;
let PATCH: typeof import("../../../app/api/organizations/[id]/settings/route").PATCH;
before(async () => {
  ({ PUT, PATCH } = await import("../../../app/api/organizations/[id]/settings/route"));
});

function request(method: "PUT" | "PATCH", body: unknown) {
  return new NextRequest("https://app.example/api/organizations/org-1/settings", {
    method,
    headers: { origin: "https://app.example", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("generic settings PUT replaces caller-owned keys, ignores a supplied reserved pointer, and preserves the published pointer", async () => {
  row = {
    id: "settings-1", organizationSlug: "sample", currency: "IRR",
    settings: {
      theme: "dark",
      oldNonReserved: { removeOnReplacement: true },
      retailHeroPublication: { revisionId: "revision-live", previousRevisionId: null, publishedAt: "2026-11-02T00:00:00.000Z" },
    },
  };
  rawCalls.length = 0;
  upserts.length = 0;
  auditCalls.length = 0;
  const incoming = { theme: "light", added: "new", retailHeroPublication: { revisionId: "attacker-selected" } };
  const response = await PUT(request("PUT", { settings: incoming }), { params: Promise.resolve({ id: "org-1" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(row.settings, {
    theme: "light", added: "new",
    retailHeroPublication: { revisionId: "revision-live", previousRevisionId: null, publishedAt: "2026-11-02T00:00:00.000Z" },
  });
  assert.equal("oldNonReserved" in (row.settings ?? {}), false, "PUT retains replacement semantics for nonreserved settings");
  assert.deepEqual(upserts[0]?.update, {}, "settings are written separately from scalar upsert fields");
  assert.doesNotMatch(String(rawCalls[0]?.values[0]), /retailHeroPublication/, "caller cannot overwrite the reserved key");
  assert.match(rawCalls[0]?.sql ?? "", /\|\| \(CASE WHEN jsonb_typeof/);
});

test("defaultPublicCapability-only PATCH still passes the empty scalar guard", async () => {
  row = { id: "settings-1", organizationSlug: "sample", settings: { retailHeroPublication: { revisionId: "revision-live", previousRevisionId: null, publishedAt: "2026-11-02T00:00:00.000Z" } } };
  rawCalls.length = 0;
  upserts.length = 0;
  auditCalls.length = 0;
  const response = await PATCH(request("PATCH", { defaultPublicCapability: "SHOP" }), { params: Promise.resolve({ id: "org-1" }) });
  assert.equal(response.status, 200);
  assert.deepEqual(row.settings, {
    retailHeroPublication: { revisionId: "revision-live", previousRevisionId: null, publishedAt: "2026-11-02T00:00:00.000Z" },
    defaultPublicCapability: "SHOP",
  });
  assert.equal(upserts.length, 1);
  assert.equal(rawCalls.length, 1);
  assert.equal(auditCalls.length, 1);
});
