import { readFile, realpath, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname, sep, extname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const siteRoot = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(await readFile(resolve(siteRoot, 'media-slots.json'), 'utf8'));
const inside = (root, file) => file.startsWith(root + sep);

// This prepares a PRIVATE review bundle. It never changes live/source assets or approvals.
export async function prepareMedia({ manifestPath, outputPath }) {
  const sourceManifest = await realpath(manifestPath);
  const inputRoot = dirname(sourceManifest);
  const manifestBytes = await readFile(sourceManifest);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets) || !manifest.assets.length) throw new Error('Expected schemaVersion 1 and nonempty assets');
  const output = resolve(outputPath);
  // Resolve the existing parent so a symlink cannot redirect a private bundle into public assets.
  const parent = await realpath(dirname(output));
  const actualOutput = resolve(parent, basename(output));
  const repoRoot = resolve(siteRoot, '../..');
  if (actualOutput === repoRoot || inside(repoRoot, actualOutput)) throw new Error('Media review output must be outside the Git repository');
  if (actualOutput === inputRoot || inside(inputRoot, actualOutput)) throw new Error('Output must be separate from original sources');
  const seen = new Set(), validated = [];
  for (const asset of manifest.assets) {
    if (!Object.hasOwn(catalog.slots, asset.slot) || seen.has(asset.slot)) throw new Error('Unknown or duplicate media slot');
    seen.add(asset.slot);
    if (typeof asset.file !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_. -]*\.(png|jpe?g|webp)$/i.test(asset.file)) throw new Error('Use a local raster filename without paths');
    const file = await realpath(resolve(inputRoot, asset.file));
    if (!inside(inputRoot, file)) throw new Error('Media file escapes original source folder');
    const details = await stat(file);
    if (!details.isFile() || !details.size || details.size > 20 * 1024 * 1024) throw new Error('Image must be between 1 byte and 20 MiB');
    const bytes = await readFile(file);
    if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('Image must be between 1 byte and 20 MiB');
    const extension = extname(asset.file).toLowerCase();
    const validMagic = extension === '.png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : extension === '.webp' ? bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP'
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!validMagic) throw new Error('Raster file signature does not match its extension');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (sha256 !== asset.sha256) throw new Error('Media SHA256 mismatch');
    if (!['APPROVED','PENDING'].includes(asset.approval?.status)) throw new Error('Explicit approval status required');
    if (asset.approval.status === 'APPROVED' && (!asset.approval.reference?.trim() || !asset.approval.date?.match(/^\d{4}-\d{2}-\d{2}$/) || asset.rights !== 'PUBLICATION_PERMITTED')) throw new Error('Approved media needs decision reference/date and publication rights');
    if (!asset.subject?.trim()) throw new Error('Depicted space or logo subject required');
    for (const locale of ['fa','en','ar']) if (typeof asset.alt?.[locale] !== 'string' || !asset.alt[locale].trim()) throw new Error('Alternative text is required in fa/en/ar');
    validated.push({ asset, bytes, sha256, outputName: `${asset.slot}${extension}` });
  }
  // Exclusive directory creation: a review never overwrites an earlier bundle or originals.
  await mkdir(actualOutput);
  for (const item of validated) await writeFile(resolve(actualOutput, item.outputName), item.bytes, { flag: 'wx' });
  const review = { schemaVersion: 1, status: 'PREPARED_NOT_PUBLISHED',
    sourceManifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    requiresVisualReview: true, activationPerformed: false,
    assets: validated.map(({asset,sha256,outputName}) => ({slot:asset.slot,file:outputName,sha256,subject:asset.subject,alt:asset.alt,rights:asset.rights || 'UNCONFIRMED',approval:asset.approval,currentAsset:catalog.slots[asset.slot].currentAsset})) };
  await writeFile(resolve(actualOutput, 'review.json'), JSON.stringify(review,null,2)+'\n');
  return review;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [, , manifestPath, outputPath] = process.argv;
  if (!manifestPath || !outputPath) { console.error('Usage: node prepare-media.mjs <private-input-manifest.json> <new-private-output-directory>'); process.exitCode = 1; }
  else try { const review = await prepareMedia({manifestPath,outputPath}); console.log(JSON.stringify({status:review.status,assets:review.assets.length,activationPerformed:false})); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
