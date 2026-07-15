#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checks = [];
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(root, rel));
const add = (name, pass, detail = "") => checks.push({ name, pass: Boolean(pass), detail });

function collectSource(dir, out = []) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replaceAll(path.sep, "/");
    if (entry.isDirectory()) collectSource(rel, out);
    else if (/\.(ts|tsx|js|mjs|mts)$/.test(rel)) out.push(rel);
  }
  return out;
}

const sourceFiles = ["app", "components", "lib", "scripts"].flatMap((dir) => collectSource(dir));
const fileText = (file) => read(file);
const blobImports = sourceFiles
  .filter((file) => !file.startsWith("scripts/quality/"))
  .filter((file) => /@vercel\/blob/.test(fileText(file)));
const clientBlobMentions = collectSource("components")
  .concat(collectSource("app/[locale]"))
  .filter((file) => /BLOB_READ_WRITE_TOKEN|@vercel\/blob|storage\/application-storage|blob-storage/.test(fileText(file)));
const aiMediaFeatureFiles = sourceFiles.filter((file) =>
  /(app\/api\/dashboard\/.*ai|app\/api\/internal\/creative-studio|lib\/services\/ai-media|lib\/services\/creative-studio)/.test(file),
);
const directBlobInFeature = aiMediaFeatureFiles.filter((file) => /@vercel\/blob|uploadToBlob|deleteFromBlob|copyRemoteImageToBlob|BLOB_READ_WRITE_TOKEN/.test(fileText(file)));

const gateway = read("lib/storage/application-storage.ts");
const vercelAdapter = read("lib/storage/vercel-blob-storage.ts");
const localAdapter = read("lib/storage/local-test-storage.ts");
const imageValidation = read("lib/storage/image-validation.ts");
const aiService = read("lib/services/ai-media.service.ts");
const creativeService = read("lib/services/creative-studio.service.ts");
const packageJson = read("package.json");

add("application storage gateway exists and is server-only", exists("lib/storage/application-storage.ts") && /import "server-only"/.test(gateway));
add("gateway exposes narrow creative-studio asset operations", /storeCreativeStudioAsset/.test(gateway) && /removeCreativeStudioAsset/.test(gateway) && /verifyStoredAsset/.test(gateway) && /compensateFailedAssetImport/.test(gateway));
add("gateway generates organization-scoped storage keys", /creative-studio/.test(gateway) && /normalizeOrganizationId/.test(gateway) && /createApplicationStorageKey/.test(gateway));
add("gateway rejects provider result URL risks", /assertFetchableResultUrl/.test(gateway) && /Provider result URL must use HTTPS/.test(gateway) && /isPrivateOutputHost/.test(gateway) && /redirect: "error"/.test(gateway));
add("gateway validates result bytes before storage", /validateApplicationImageBuffer/.test(gateway) && /content-length/.test(gateway));
add("image validation enforces MIME signatures size and checksum", /APPLICATION_STORAGE_ALLOWED_IMAGE_TYPES/.test(imageValidation) && /IMAGE_SIGNATURES/.test(imageValidation) && /APPLICATION_STORAGE_MAX_IMAGE_BYTES/.test(imageValidation) && /checksumSha256/.test(imageValidation));
add("production adapter is server-only and owns Blob SDK import", /import "server-only"/.test(vercelAdapter) && /@vercel\/blob/.test(vercelAdapter) && /BLOB_READ_WRITE_TOKEN/.test(vercelAdapter));
add("only canonical production adapter imports @vercel/blob", blobImports.length === 1 && blobImports[0] === "lib/storage/vercel-blob-storage.ts", blobImports.join(", "));
add("local test adapter is server-only", /import "server-only"/.test(localAdapter));
add("local test adapter cannot activate in production", /NODE_ENV === "production"/.test(localAdapter) && /VERCEL_ENV === "production"/.test(localAdapter));
add("local test adapter stays inside workspace and prevents traversal", /path\.isAbsolute/.test(localAdapter) && /includes\("\.\."\)/.test(localAdapter) && /startsWith\(root \+ path\.sep\)/.test(localAdapter));
add("AI-media selection uses application storage gateway", /storeCreativeStudioAssetFromRemote/.test(aiService) && /compensateFailedAssetImport/.test(aiService));
add("AI-media selection no longer persists remote fallback", !/remote-unconfigured|remote-fallback|copyRemoteImageToBlob|shouldUseVercelBlob/.test(aiService));
add("Creative Studio product-image drafts import through application storage", /storeCreativeStudioAssetFromRemote/.test(creativeService) && /p04aApplicationStorage/.test(creativeService) && /sourceUrlPermanent: false/.test(creativeService));
add("feature code has no direct Blob calls", directBlobInFeature.length === 0, directBlobInFeature.join(", "));
add("client surfaces do not import storage or Blob credentials", clientBlobMentions.length === 0, clientBlobMentions.join(", "));
add("package exposes P04A-P06A validators", /quality:ai-media-application-storage-boundary/.test(packageJson) && /quality:ai-media-no-direct-production-blob/.test(packageJson) && /quality:ai-media-hermetic-environment/.test(packageJson));

for (const check of checks) console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
const failed = checks.filter((check) => !check.pass);
if (failed.length) {
  console.error(`AI media P04A-P06A validation failed with ${failed.length} issue(s).`);
  process.exit(1);
}

console.log("AI media P04A-P06A validation passed.");
