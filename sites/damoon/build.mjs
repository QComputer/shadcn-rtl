import { cp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { assertCleanDamoonAssets } from './encoding-guard.mjs';
import { legacyAccommodationPaths, pages, rooms } from './content.js';
import { damoonAttractionsData } from './damoon-attractions-data.js';
import { paletteStyles } from './themes.js';
const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const directPublic = process.argv.includes('--sync-public-direct');
const publicDir = join(root, '..', '..', 'public', 'damoon-front');
const output = directPublic ? publicDir : join(root, 'dist');
const assetPrefix = process.argv.includes('--shared-runtime') ? '/damoon-front' : '';
await mkdir(output, { recursive: true });
const files = ['index.html','styles.css','booking.css','accommodation.css','hospitality.css','damoon-attractions.css','accommodation.js','hospitality.js','damoon-attractions-data.js','damoon-attractions-view.js','damoon-attractions-detail-view.js','damoon-leaflet-maps.js','app.js','content.js','translations.js','themes.js','booking.js','booking-flow.js','calendar.js','virtual-tour.js','robots.txt'];
for (const f of files) {
  let text = (await readFile(join(root,f),'utf8')).replaceAll('\r\n','\n');
  if (assetPrefix) {
    text = text.replaceAll('/assets/', `${assetPrefix}/assets/`);
    for (const sheet of ['styles.css','booking.css','theme-tokens.css','accommodation.css','hospitality.css','damoon-attractions.css']) text = text.replaceAll(`href="/${sheet}"`, `href="${assetPrefix}/${sheet}"`);
    text = text.replace('src="/app.js"', `src="${assetPrefix}/app.js"`);
  }
  await writeFile(join(output,f),text);
}
await writeFile(join(root,'theme-tokens.css'),paletteStyles());
await writeFile(join(output,'theme-tokens.css'),paletteStyles());
if (!directPublic) await cp(join(root,'assets'), join(output,'assets'), { recursive: true });
let leafletDist;
let leafletLicense;
try {
  leafletDist = dirname(require.resolve('leaflet'));
  leafletLicense = join(leafletDist, '..', 'LICENSE');
} catch (error) {
  if (error?.code !== 'MODULE_NOT_FOUND') throw error;
  // Keep standalone builds usable without installing dependencies when the
  // reviewed public bundle already contains the licensed Leaflet distribution.
  leafletDist = join(publicDir, 'vendor', 'leaflet');
  leafletLicense = join(leafletDist, 'LICENSE');
}
const leafletOutput = join(output, 'vendor', 'leaflet');
await mkdir(join(leafletOutput, 'images'), { recursive: true });
for (const file of ['leaflet.js', 'leaflet.css']) await cp(join(leafletDist, file), join(leafletOutput, file));
await cp(leafletLicense, join(leafletOutput, 'LICENSE'));
for (const file of ['marker-icon.png', 'marker-icon-2x.png', 'marker-shadow.png', 'layers.png', 'layers-2x.png']) await cp(join(leafletDist, 'images', file), join(leafletOutput, 'images', file));
const html = await readFile(join(output,'index.html'),'utf8');
const routes = [...Object.keys(pages), '/hotel-reservations/start', ...rooms.map(r=>`/rooms/${r.slug}`), ...Object.keys(legacyAccommodationPaths), ...damoonAttractionsData.attractions.map((attraction)=>`/attractions/${attraction.id}`)];
for (const route of [...routes,...['fa','en','ar'].flatMap(locale=>routes.map(r=>`/${locale}${r === '/' ? '' : r}`))]) {
  if (route === '/') continue;
  const folder = join(output, route.slice(1));
  await mkdir(folder,{recursive:true});
  await writeFile(join(folder,'index.html'),html);
}
const manifest = {};
await assertCleanDamoonAssets(output);
async function hashTree(folder, prefix = '') {
  for (const entry of await readdir(folder,{withFileTypes:true})) {
    if (entry.name === 'release-manifest.json') continue;
    const name = prefix + entry.name;
    if (entry.isDirectory()) await hashTree(join(folder,entry.name),name+'/');
    else {
      const file = join(folder, entry.name);
      let bytes = await readFile(file);
      if (entry.name === 'LICENSE' || /\.(?:html|js|css|json|svg|txt)$/.test(entry.name)) {
        const normalized = Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
        if (!bytes.equals(normalized)) await writeFile(file, normalized);
        bytes = normalized;
      }
      manifest[name] = createHash('sha256').update(bytes).digest('hex');
    }
  }
}
await hashTree(output);
await writeFile(join(output,'release-manifest.json'),JSON.stringify({ site:'damoon',contentMode:'DEVELOPMENT_WITH_CONCEPT_IMAGES',files:manifest },null,2));
console.log(`Built ${routes.length} routes with /fa, /en and /ar aliases; no package installation required.`);

if (process.argv.includes("--sync-public") && !directPublic) {
  await mkdir(publicDir, { recursive: true });
  await cp(output, publicDir, { recursive: true, force: true });
  console.log(`Synced ${output} -> ${publicDir}`);
}

