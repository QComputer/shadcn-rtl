import assert from "node:assert/strict";
import test from "node:test";
import { retailWebsiteMedia } from "@/lib/website-studio/brand-media";
import { findRetainedRetailMediaSelection, isEligibleRetailWebsiteMedia } from "@/lib/website-studio/retail-contract";

const orgId = "org_123";
const image = (id: string, url: string, filename = "hero.webp", mimeType = "image/webp", organizationId: string | null = orgId) => ({ id, url, filename, mimeType, organizationId });

test("retail Website Studio media contains only eligible public upload records and no preset assets", () => {
  const rows = [
    image("disk", `/api/media/${orgId}/tenants/${orgId}/uploads/hero.webp`),
    image("blob", "https://shop.public.blob.vercel-storage.com/hero.webp"),
    image("legacy", "/uploads/hero.webp"),
    image("static", "/brand/tenants/aka-shoes/home/hero.webp"),
    image("foreign", "/api/media/org_other/tenants/org_other/uploads/hero.webp"),
    image("wrong-owner-route", `/api/media/org_other/tenants/org_other/uploads/hero.webp`),
  ];
  assert.deepEqual(retailWebsiteMedia(orgId, rows).map((row) => row.id), ["disk", "blob", "legacy"]);
  assert.equal(rows.some((row) => row.id.startsWith("brand:")), false);
});

test("persistent disk URLs must match exact canonical route, tenant, filename and encoding", () => {
  const valid = image("owned", `/api/media/${orgId}/tenants/${orgId}/uploads/hero.webp`);
  assert.equal(isEligibleRetailWebsiteMedia(valid), true);
  for (const url of [
    `/api/media/${orgId}/tenants/org_other/uploads/hero.webp`,
    `/api/media/org_other/tenants/org_other/uploads/hero.webp`,
    `/api/media/${orgId}/tenants/${orgId}/uploads/../hero.webp`,
    `/api/media/${orgId}/tenants/${orgId}/private/hero.webp`,
    `//evil.example/api/media/${orgId}/tenants/${orgId}/uploads/hero.webp`,
    `http://evil.example/${orgId}/tenants/${orgId}/uploads/hero.webp`,
    `/api/media/${orgId}/tenants/${orgId}/uploads/%68ero.webp`,
  ]) assert.equal(isEligibleRetailWebsiteMedia({ ...valid, url }), false, url);
  assert.deepEqual(retailWebsiteMedia(orgId, [{ ...valid, organizationId: "org_other", url: "/api/media/org_other/tenants/org_other/uploads/hero.webp" }]), []);
});

test("a selected image remains addressable when it is not in the current gallery search page", () => {
  const selected = image("selected-outside-page", `/api/media/${orgId}/tenants/${orgId}/uploads/selected.webp`);
  const page = [image("search-result", `/api/media/${orgId}/tenants/${orgId}/uploads/result.webp`)];
  assert.equal(findRetainedRetailMediaSelection(page, [selected], selected.id)?.filename, "hero.webp");
  assert.equal(findRetainedRetailMediaSelection(page, [selected], "search-result")?.id, "search-result");
  assert.equal(findRetainedRetailMediaSelection(page, [selected], "missing"), undefined);
});
