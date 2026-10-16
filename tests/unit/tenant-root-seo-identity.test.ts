import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPublicMetadata } from "@/lib/seo";

test("tenant root SEO uses the resolved tenant application identity", () => {
  const metadata = buildPublicMetadata({
    locale: "fa",
    baseUrl: "https://tenant.example",
    path: "/fa",
    title: "فروشگاه آزمایشی",
    applicationName: "فروشگاه آزمایشی",
    siteName: "فروشگاه آزمایشی",
  });

  assert.equal(metadata.applicationName, "فروشگاه آزمایشی");
  assert.equal(metadata.openGraph?.siteName, "فروشگاه آزمایشی");
  assert.equal(metadata.alternates?.canonical, "https://tenant.example/fa");
});

test("canonical platform SEO keeps its own default identity", () => {
  const metadata = buildPublicMetadata({ locale: "fa", path: "/fa", title: "بازارباز" });
  assert.equal(metadata.applicationName, undefined);
  assert.equal(metadata.openGraph?.siteName, "Bazarbaaz");
});
