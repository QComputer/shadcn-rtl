import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile, copyFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("tsx/package.json"))("esbuild");
const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
const packageRoot = path.join(root, ".tmp", "damoon-owner-preview-package");
const output = path.join(packageRoot, ".vercel", "output");
const site = path.join(output, "static");
const assetDir = path.join(site, "assets");
await mkdir(assetDir, { recursive: true });
const result = await esbuild.build({
  absWorkingDir: root, entryPoints: ["preview/damoon-owner/entry.tsx"], bundle: true, write: false,
  platform: "browser", format: "iife", jsx: "automatic", minify: true, metafile: true,
  define: { "process.env.NODE_ENV": '"production"' }, outfile: "assets/app.js",
  loader: { ".css": "local-css" },
  alias: { "next/image": path.join(root, "tests/fixtures/room-showcase-image.tsx") },
});
for (const input of Object.keys(result.metafile.inputs)) {
  assert.ok(!/lib[\\/]db(?:[.-]|[\\/])|@prisma|lib[\\/]auth|inoti|nodemailer/i.test(input), `Forbidden preview dependency: ${input}`);
}
for (const file of result.outputFiles) await writeFile(path.join(assetDir, path.basename(file.path)), file.contents);
await copyFile(path.join(root, "preview/damoon-owner/base.css"), path.join(assetDir, "base.css"));
const images = ["lobby-concept.webp", "architecture-concept.webp", "room-concept-1.webp", "room-concept-2.webp", "room-concept-3.webp", "gallery-concept-1.webp", "gallery-concept-2.webp", "gallery-concept-3.webp"];
for (const directory of ["images", "fonts"]) await mkdir(path.join(site, directory), { recursive: true });
for (const file of images) await copyFile(path.join(root, "public/images", file), path.join(site, "images", file));
for (const file of ["Vazirmatn-Regular.ttf", "Vazirmatn-Bold.ttf"]) await copyFile(path.join(root, "public/fonts", file), path.join(site, "fonts", file));
const titles = { fa: "هتل دامون · پیش‌نمایش مفهومی", en: "Hotel Damoon · Concept preview", ar: "فندق دامون · معاينة تصورية" };
for (const locale of ["fa", "en", "ar"]) {
  await mkdir(path.join(site, locale), { recursive: true });
  await writeFile(path.join(site, locale, "index.html"), `<!doctype html><html lang="${locale}" dir="${locale === "en" ? "ltr" : "rtl"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer"><title>${titles[locale]}</title><link rel="stylesheet" href="/assets/base.css"><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"><p role="status">${titles[locale]} — …</p></div><noscript>JavaScript is required for this interactive concept preview.</noscript><script src="/assets/app.js" defer></script></body></html>`);
}
await writeFile(path.join(site, "robots.txt"), "User-agent: *\nDisallow: /\n");
await writeFile(path.join(site, "404.html"), '<!doctype html><meta name="robots" content="noindex,nofollow"><title>Preview unavailable</title><h1>Preview unavailable</h1><a href="/fa/">Hotel Damoon concept preview</a>');
const headers = {
  "X-Robots-Tag": "noindex, nofollow, noarchive", "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};
const config = { version: 3, routes: [
  { src: "/.*", headers, continue: true },
  { src: "/", status: 307, headers: { Location: "/fa/" } },
  { src: "/(fa|en|ar)/?", dest: "/$1/index.html" },
  { handle: "filesystem" }, { src: "/.*", dest: "/404.html", status: 404 },
] };
await writeFile(path.join(output, "config.json"), `${JSON.stringify(config, null, 2)}\n`);
await writeFile(path.join(packageRoot, ".vercel", "project.json"), JSON.stringify({ projectId: "prj_mdMJzn5Jn6oTxDyVW5GrsnvqGPaC", orgId: "team_SXzXqmBelw5uJhsXMckCDajv", projectName: "damoon-hotel-owner-preview" }));
await writeFile(path.join(packageRoot, "vercel.json"), JSON.stringify({ framework: null }));
const files = [];
async function inventory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inventory(file);
    else { const bytes = await readFile(file); files.push({ path: path.relative(output, file).replaceAll("\\", "/"), bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }); }
  }
}
await inventory(output);
const manifest = { sourceCommit: sha, mode: "SYNTHETIC_PREVIEW", projectId: "prj_mdMJzn5Jn6oTxDyVW5GrsnvqGPaC", runtime: "STATIC_ONLY", database: false, functions: false, providers: false, assets: files.sort((a, b) => a.path.localeCompare(b.path)) };
await writeFile(path.join(site, "preview-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(path.join(packageRoot, "artifact-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ packageRoot, sourceCommit: sha, files: files.length, bytes: files.reduce((total, file) => total + file.bytes, 0), runtime: "STATIC_ONLY" }));
if (process.argv.includes("--serve")) {
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".ttf": "font/ttf", ".json": "application/json", ".txt": "text/plain" };
  createServer(async (request, response) => {
    const route = new URL(request.url, "http://127.0.0.1").pathname;
    if (route === "/") { response.writeHead(307, { ...headers, Location: "/fa/" }); response.end(); return; }
    const relative = /^\/(fa|en|ar)\/?$/.test(route) ? `${route.replace(/\/$/, "")}/index.html` : route;
    const file = path.resolve(site, `.${decodeURIComponent(relative)}`);
    if (!file.startsWith(`${site}${path.sep}`)) { response.writeHead(403); response.end(); return; }
    try { const bytes = await readFile(file); response.writeHead(200, { ...headers, "Content-Type": types[path.extname(file)] ?? "application/octet-stream" }); response.end(bytes); }
    catch { response.writeHead(404, headers); response.end("Preview unavailable"); }
  }).listen(4179, "127.0.0.1", () => console.log("Static preview server listening on http://127.0.0.1:4179"));
}
