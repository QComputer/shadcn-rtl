import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "@/lib/api-guards";
import { tenantBrandWebsiteMedia } from "@/lib/website-studio/brand-media";
import { RetailWebsiteService, retailWebsiteScope, type StudioPrincipal } from "@/lib/website-studio/retail.service";
import { initialRetailContent, type RetailContent } from "@/lib/website-studio/retail-contract";

const org = { id: "org-1", name: "نمونه", slug: "sample", description: null, phone: null, email: null, address: null };
const principal: StudioPrincipal = { userId: "user-1", role: "ADMIN", organizationId: "org-1" };
const content = initialRetailContent(org);
const media = [{ id: "image-1", url: "/uploads/one.jpg", filename: "one.jpg", mimeType: "image/jpeg" }];

type MockOptions = {
  currentRevision?: string | null;
  previous?: { id: string; content: RetailContent; requestId: string; createdBy: string; createdAt: Date } | null;
  member?: boolean;
  userRole?: string;
  organization?: typeof org | null;
  images?: typeof media;
};

function mockService(options: MockOptions = {}) {
  const calls: { insert: number; membership: number; images: number; insertedValues: unknown[] } = { insert: 0, membership: 0, images: 0, insertedValues: [] };
  const revisionId = options.currentRevision ?? null;
  const previous = options.previous ?? null;
  const tx = {
    user: { findFirst: async () => options.userRole === "MISSING" ? null : { role: options.userRole ?? "ADMIN" } },
    organization: { findFirst: async () => options.organization === null ? null : options.organization ?? org },
    organizationMember: { findFirst: async () => { calls.membership++; return options.member === false ? null : { id: "member-1" }; } },
    image: { findMany: async () => { calls.images++; return options.images ?? media; } },
    auditLog: { create: async () => ({}) },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes("INSERT INTO \"TenantWebsiteRevision\"")) {
        calls.insert++;
        calls.insertedValues = values;
        return [{ id: "new-revision", content: JSON.parse(String(values[2])) as RetailContent, createdAt: new Date("2026-10-18T10:00:00Z"), requestId: String(values[4]), createdBy: principal.userId }];
      }
      if (sql.includes('"requestId"')) return previous ? [previous] : [];
      if (sql.includes('ORDER BY "createdAt" DESC, id DESC')) return revisionId ? [{ id: revisionId }] : [];
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

test("saving rejects media outside the eligible public organization set", async () => {
  const next = structuredClone(content);
  next.sections = next.sections.map((section) => section.kind === "HERO" ? { ...section, imageId: "foreign-or-private" } : section);
  const { service, calls } = mockService();
  await assert.rejects(service.save(principal, "org-1", draft(undefined, null, next)), (error: unknown) => error instanceof ApiError && error.status === 422);
  assert.equal(calls.insert, 0);
});

test("saving accepts current tenant registry media and rejects another tenant's brand image id", async () => {
  const akaMedia = tenantBrandWebsiteMedia("aka-shoes");
  assert.ok(akaMedia.length > 0);
  const selected = akaMedia[0]!;
  const withBrandImage = structuredClone(content);
  withBrandImage.sections = withBrandImage.sections.map((section) => section.kind === "HERO" ? { ...section, imageId: selected.id } : section);
  const aka = mockService({ organization: { ...org, slug: "aka-shoes" }, images: [] });
  const saved = await aka.service.save(principal, "org-1", draft(undefined, null, withBrandImage));
  assert.deepEqual(saved.content, withBrandImage);
  assert.equal(aka.calls.insert, 1);

  const restaurant = mockService({ organization: { ...org, slug: "italiano-13" }, images: [] });
  await assert.rejects(restaurant.service.save(principal, "org-1", draft(undefined, null, withBrandImage)), (error: unknown) => error instanceof ApiError && error.status === 422);
  assert.equal(restaurant.calls.insert, 0);
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
