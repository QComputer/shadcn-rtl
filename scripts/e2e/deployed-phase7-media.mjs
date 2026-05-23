const baseUrl = process.env.DEPLOYED_URL || "http://localhost:3000";

const checks = [];

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (error) {
    checks.push({ name, ok: false, detail: error?.message || String(error) });
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

function url(path) {
  return new URL(path, baseUrl).toString();
}

async function expectStatus(name, path, init, allowedStatuses) {
  const response = await fetch(url(path), init);
  if (!allowedStatuses.includes(response.status)) {
    const text = await response.text().catch(() => "");
    throw new Error(`${name}: expected ${allowedStatuses.join("/")}, got ${response.status}. ${text.slice(0, 200)}`);
  }
}

await check("homepage is reachable", async () => {
  await expectStatus("homepage", "/fa", {}, [200, 307, 308]);
});

await check("unauthenticated upload is blocked", async () => {
  const form = new FormData();
  form.append("file", new Blob(["not an image"], { type: "text/plain" }), "test.txt");
  await expectStatus("upload", "/api/upload", { method: "POST", body: form }, [401, 403]);
});

await check("unauthenticated image list is blocked", async () => {
  await expectStatus("image list", "/api/images", {}, [401, 403]);
});

await check("unauthenticated image delete is blocked", async () => {
  await expectStatus("image delete", "/api/images/phase7-smoke-id", { method: "DELETE" }, [401, 403]);
});

await check("public QR image generation still works", async () => {
  const response = await fetch(url(`/api/qrcode?url=${encodeURIComponent(baseUrl)}`));
  if (response.status !== 200) {
    throw new Error(`Expected 200 from QR GET, got ${response.status}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("image/png")) {
    throw new Error(`Expected image/png QR response, got ${contentType}`);
  }
});

await check("unauthenticated QR save is blocked", async () => {
  await expectStatus(
    "qr save",
    "/api/qrcode",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: baseUrl }),
    },
    [401, 403],
  );
});

await check("upload filename traversal is not publicly served", async () => {
  await expectStatus("traversal", "/uploads/..%2Fpackage.json", {}, [400, 404]);
});

console.table(checks);

const failed = checks.filter((item) => !item.ok);
if (failed.length > 0) {
  process.exitCode = 1;
}
