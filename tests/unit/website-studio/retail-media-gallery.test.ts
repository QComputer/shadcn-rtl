import assert from "node:assert/strict";
import { before, mock, test } from "node:test";
import type { WebsiteMedia } from "@/lib/website-studio/retail-contract";
import { parseRetailMediaGalleryRequest, retailMediaGalleryResponse, retailMediaGalleryWhere } from "@/lib/website-studio/retail-media-gallery.server";

const organizationId = "org-gallery-a";
let query: unknown;
let fixtureRows: Array<WebsiteMedia & { createdAt: Date }> = [];
let deleteImageCalls: unknown[] = [];
let deleteStoredCalls: unknown[] = [];

class GalleryApiError extends Error { constructor(public status: number, message: string) { super(message); } }

mock.module("@/lib/db", { namedExports: {
  prisma: {
    image: {
      findMany: async (value: unknown) => { query = value; return fixtureRows; },
      deleteMany: async (value: unknown) => { deleteImageCalls.push(value); return { count: 0 }; },
    },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
      image: { create: async () => ({ id: "uploaded-image" }) },
      auditLog: { create: async () => { throw new Error("Invalid synthetic audit insert"); } },
    }),
  },
} });
mock.module("@/lib/api-guards", { namedExports: {
  ApiError: GalleryApiError,
  jsonError: (error: unknown, fallback: string) => Response.json({ error: error instanceof Error ? error.message : fallback }, { status: error instanceof GalleryApiError ? error.status : 500 }),
  requireAuthSession: async () => ({ user: { id: "manager-a", role: "MANAGER", organizationId } }),
  requireSameOriginMutation: () => undefined,
} });
mock.module("@/lib/website-studio/retail.service", { namedExports: {
  RetailWebsiteService: class {
    async authorizeOrganization(_principal: unknown, id: string) { return { id }; }
    async filterDeliverableMedia(_organizationId: string, images: WebsiteMedia[]) { return images.filter(image => image.filename !== "missing-object.webp"); }
  },
} });
mock.module("@/lib/media-storage", { namedExports: {
  createStoredImageFilename: () => "unused.png",
  deleteStoredImage: async (...args: unknown[]) => { deleteStoredCalls.push(args); },
  writeStoredImage: async () => ({ pathname: "unused.png", url: `/api/media/${organizationId}/tenants/${organizationId}/uploads/unused.png` }),
} });
mock.module("@/lib/website-studio/hero-upload.server", { namedExports: { MAX_RETAIL_HERO_UPLOAD_BYTES: 5_000_000, validateRetailHeroUpload: async () => undefined } });

let GET: typeof import("../../../app/api/organizations/[id]/website/media/route").GET;
let POST: typeof import("../../../app/api/organizations/[id]/website/media/route").POST;
before(async () => { ({ GET, POST } = await import("../../../app/api/organizations/[id]/website/media/route")); });

const eligibleRow = (id: string, owner = organizationId, createdAt = new Date("2026-11-13T10:00:00.000Z")) => ({
  id, organizationId: owner, filename: `${id}.webp`, mimeType: "image/webp", sizeBytes: 100,
  url: `/api/media/${owner}/tenants/${owner}/uploads/${id}.webp`, createdAt,
});

test("gallery query is tenant/public scoped, searches server-side, and uses bounded stable cursor pagination", () => {
  const parsed = parseRetailMediaGalleryRequest("https://app.example/gallery?q=summer%20shoe");
  assert.equal(parsed.search, "summer shoe");
  assert.deepEqual(retailMediaGalleryWhere(organizationId, parsed.search, null), {
    organizationId, access: "PUBLIC", mimeType: { in: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
    filename: { contains: "summer shoe", mode: "insensitive" },
  });
  const rows = Array.from({ length: 25 }, (_, index) => eligibleRow(`image-${index}`, organizationId, new Date(1_700_000_000_000 - index * 1000)));
  const firstPage = retailMediaGalleryResponse(rows);
  assert.equal(firstPage.rows.length, 24);
  assert.ok(firstPage.nextCursor);
  const next = parseRetailMediaGalleryRequest(`https://app.example/gallery?cursor=${firstPage.nextCursor}`);
  assert.deepEqual(retailMediaGalleryWhere(organizationId, "", next.cursor).OR, [
    { createdAt: { lt: new Date("2023-11-14T22:12:57.000Z") } },
    { createdAt: new Date("2023-11-14T22:12:57.000Z"), id: { gt: "image-23" } },
  ]);
  assert.equal(retailMediaGalleryResponse(rows.slice(0, 24)).nextCursor, null);
  assert.throws(() => parseRetailMediaGalleryRequest(`https://app.example/gallery?q=${"x".repeat(101)}`), /طولانی/);
  assert.throws(() => parseRetailMediaGalleryRequest("https://app.example/gallery?cursor=not-a-cursor"), /نشانگر/);
});

test("gallery GET returns bounded, owned, structurally eligible, deliverable media for the authorized tenant", async () => {
  fixtureRows = [eligibleRow("owned-a"), eligibleRow("foreign-b", "org-gallery-b"), {
    ...eligibleRow("brand-static"), url: "/brand/tenants/org-gallery-a/home/hero.webp",
  }, eligibleRow("missing-object" )];
  const response = await GET(new Request("https://app.example/api/organizations/org-gallery-a/website/media?q=summer"), { params: Promise.resolve({ id: organizationId }) });
  const body = await response.json() as { images: WebsiteMedia[]; nextCursor: string | null };
  assert.equal(response.status, 200);
  assert.deepEqual(body.images.map(image => image.id), ["owned-a"]);
  assert.equal(body.nextCursor, null);
  assert.deepEqual(query, {
    where: { organizationId, access: "PUBLIC", mimeType: { in: ["image/jpeg", "image/png", "image/webp", "image/gif"] }, filename: { contains: "summer", mode: "insensitive" } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 25,
    select: { id: true, url: true, filename: true, mimeType: true, sizeBytes: true, organizationId: true, createdAt: true },
  });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("unexpected database failure returns 500 and compensates the staged image and record", async () => {
  deleteImageCalls = [];
  deleteStoredCalls = [];
  const form = new FormData();
  form.append("file", new Blob(["synthetic png bytes"], { type: "image/png" }), "upload.png");
  const request = new Request("https://app.example/api/organizations/org-gallery-a/website/media", {
    method: "POST",
    headers: { origin: "https://app.example", "content-length": "100" },
    body: form,
  });
  const response = await POST(request, { params: Promise.resolve({ id: organizationId }) });
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(deleteImageCalls, [{ where: { id: "uploaded-image" } }]);
  assert.deepEqual(deleteStoredCalls, [["unused.png", organizationId]]);
});
