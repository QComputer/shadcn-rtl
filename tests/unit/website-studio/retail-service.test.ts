import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@/lib/api-guards";
import { RetailWebsiteService, retailWebsiteScope, type StudioPrincipal } from "@/lib/website-studio/retail.service";
import { initialRetailContent, type RetailContent } from "@/lib/website-studio/retail-contract";
import { legacyPublishedRetailHeroMedia } from "@/lib/website-studio/legacy-retail-hero-media.server";

const org = { id: "org-1", name: "نمونه", slug: "sample", description: null, phone: null, email: null, address: null };
const principal: StudioPrincipal = { userId: "user-1", role: "ADMIN", organizationId: "org-1" };
const content = initialRetailContent(org);
const media = [{ id: "image-1", url: "/uploads/one.jpg", filename: "one.jpg", mimeType: "image/jpeg", organizationId: "org-1" }];

type MockOptions = {
  currentRevision?: string | null;
  latestContent?: RetailContent;
  previous?: { id: string; content: RetailContent; requestId: string; createdBy: string; createdAt: Date } | null;
  member?: boolean;
  userRole?: string;
  organization?: typeof org | null;
  images?: typeof media;
};

function mockService(options: MockOptions = {}) {
  const calls: { insert: number; membership: number; images: number; imageQueries: unknown[]; insertedValues: unknown[] } = { insert: 0, membership: 0, images: 0, imageQueries: [], insertedValues: [] };
  const revisionId = options.currentRevision ?? null;
  const previous = options.previous ?? null;
  const tx = {
    user: { findFirst: async () => options.userRole === "MISSING" ? null : { role: options.userRole ?? "ADMIN" } },
    organization: { findFirst: async () => options.organization === null ? null : options.organization ?? org },
    organizationMember: { findFirst: async () => { calls.membership++; return options.member === false ? null : { id: "member-1" }; } },
    tenantWebsiteRevision: { findFirst: async () => null },
    organizationSettings: { findUnique: async () => null },
    image: { findMany: async (query: unknown) => { calls.images++; calls.imageQueries.push(query); return options.images ?? media; } },
    auditLog: { create: async () => ({}) },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes("INSERT INTO \"TenantWebsiteRevision\"")) {
        calls.insert++;
        calls.insertedValues = values;
        return [{ id: "new-revision", content: JSON.parse(String(values[2])) as RetailContent, createdAt: new Date("2026-10-18T10:00:00Z"), requestId: String(values[4]), createdBy: principal.userId }];
      }
      if (sql.includes('"requestId"')) return previous ? [previous] : [];
      if (sql.includes('ORDER BY "createdAt" DESC, id DESC')) return revisionId ? [{ id: revisionId, content: options.latestContent ?? content, createdAt: new Date(), requestId: "latest", createdBy: principal.userId }] : [];
      return [];
    },
  };
  const db = { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(tx) };
  return { service: new RetailWebsiteService(db as never), calls };
}

function draft(requestId = "7a0c5b5d-5957-4822-8a7f-06d35dc76c93", baseRevisionId: string | null = null, next = content) {
  return { content: next, requestId, baseRevisionId };
}

test("authorization uses organization scope, current active membership, and active SHOP capability organization", async () => {
  assert.equal("vertical" in retailWebsiteScope, false, "SHOP capability, not a taxonomy list, gates website editing");
  assert.deepEqual(retailWebsiteScope.capabilities, { some: { key: "SHOP", status: "ACTIVE", enabledAt: { not: null } } });

  const wrongScope = mockService();
  await assert.rejects(wrongScope.service.load(principal, "org-2"), (error: unknown) => error instanceof ApiError && error.status === 403);
  assert.equal(wrongScope.calls.membership, 0);

  const noMember = mockService({ member: false });
  await assert.rejects(noMember.service.load(principal, "org-1"), (error: unknown) => error instanceof ApiError && error.status === 403);

  const noShop = mockService({ organization: null });
  await assert.rejects(noShop.service.load(principal, "org-1"), (error: unknown) => error instanceof ApiError && error.status === 403);

  const inactiveUser = mockService({ userRole: "MISSING" });
  await assert.rejects(inactiveUser.service.load(principal, "org-1"), (error: unknown) => error instanceof ApiError && error.status === 403);
});

test("studio bootstrap loads a bounded tenant page rather than the full gallery", async () => {
  const { service, calls } = mockService();
  await service.load(principal, "org-1");
  assert.equal(calls.imageQueries.length, 1);
  assert.deepEqual(calls.imageQueries[0], {
    where: { organizationId: "org-1", access: "PUBLIC", mimeType: { in: ["image/jpeg", "image/png", "image/webp", "image/gif"] } },
    select: { id: true, url: true, filename: true, mimeType: true, sizeBytes: true, organizationId: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 24,
  });
});

test("saving rejects media outside the eligible public organization set", async () => {
  const next = structuredClone(content);
  next.sections = next.sections.map((section) => section.kind === "HERO" ? { ...section, imageId: "foreign-or-private" } : section);
  const { service, calls } = mockService();
  await assert.rejects(service.save(principal, "org-1", draft(undefined, null, next)), (error: unknown) => error instanceof ApiError && error.status === 422);
  assert.equal(calls.insert, 0);
});

test("saving allows only unchanged same-tenant legacy references in their original field", async () => {
  const selected = legacyPublishedRetailHeroMedia("aka-shoes")[0]!;
  const prior = structuredClone(content);
  prior.sections = prior.sections.map((section) => section.kind === "ABOUT" ? { ...section, imageId: selected.id } : section);
  const edited = structuredClone(prior);
  edited.title = "Updated draft";
  const { service, calls } = mockService({ organization: { ...org, slug: "aka-shoes" }, images: [], currentRevision: "revision-1", latestContent: prior });
  const result = await service.save(principal, "org-1", draft(undefined, "revision-1", edited));
  assert.deepEqual(result.content, edited);
  assert.equal(calls.insert, 1);
});

test("saving rejects newly introduced legacy references with field and media diagnostics", async () => {
  const selected = legacyPublishedRetailHeroMedia("aka-shoes")[0]!;
  const edited = structuredClone(content);
  edited.sections = edited.sections.map((section) => section.kind === "ABOUT" ? { ...section, imageId: selected.id, visible: false } : section);
  const { service, calls } = mockService({ organization: { ...org, slug: "aka-shoes" }, images: [] });
  await assert.rejects(service.save(principal, "org-1", draft(undefined, null, edited)), (error: unknown) => {
    assert.ok(error instanceof ApiError && error.status === 422);
    assert.deepEqual(error.diagnostics, [{ path: "sections.1.imageId", mediaId: selected.id, reason: "LEGACY_REPLACEMENT_REQUIRED" }]);
    return true;
  });
  assert.equal(calls.insert, 0);
});

test("saving checks the latest revision and returns 409 for a stale base", async () => {
  const { service, calls } = mockService({ currentRevision: "revision-newer" });
  await assert.rejects(service.save(principal, "org-1", draft(undefined, null)), (error: unknown) => error instanceof ApiError && error.status === 409);
  assert.equal(calls.insert, 0);
});

test("saving persists section visibility and user-edited content as the returned revision", async () => {
  const edited = structuredClone(content);
  edited.sections = edited.sections.map((section) => section.kind === "HERO" ? { ...section, visible: false, heading: "ویرایش شده" } : section);
  const { service, calls } = mockService();
  const result = await service.save(principal, "org-1", draft(undefined, null, edited));
  assert.equal(result.id, calls.insertedValues[0]);
  assert.deepEqual(result.content, edited);
  assert.deepEqual(JSON.parse(String(calls.insertedValues[2])), edited);
  assert.equal(calls.insert, 1);
});

test("saving is idempotent for the same request, author, and content but conflicts on key reuse", async () => {
  const requestId = "7a0c5b5d-5957-4822-8a7f-06d35dc76c93";
  const prior = { id: "revision-existing", content, requestId, createdBy: principal.userId, createdAt: new Date("2026-10-18T10:00:00Z") };
  const same = mockService({ previous: prior });
  const result = await same.service.save(principal, "org-1", draft(requestId));
  assert.equal(result.id, prior.id);
  assert.equal(same.calls.insert, 0);

  const changed = structuredClone(content);
  changed.title = "Different";
  const reused = mockService({ previous: prior });
  await assert.rejects(reused.service.save(principal, "org-1", draft(requestId, null, changed)), (error: unknown) => error instanceof ApiError && error.status === 409);
  assert.equal(reused.calls.insert, 0);
});
