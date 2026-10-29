import { cp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { pages, rooms } from './content.js';
import { paletteStyles } from './themes.js';
const root = dirname(fileURLToPath(import.meta.url));
const output = join(root, 'dist');
const assetPrefix = process.argv.includes('--shared-runtime') ? '/damoon-front' : '';
await mkdir(output, { recursive: true });
const files = ['index.html','styles.css','booking.css','accommodation.css','hospitality.css','accommodation.js','hospitality.js','app.js','content.js','translations.js','themes.js','booking.js','calendar.js','robots.txt'];
for (const f of files) {
  let text = (await readFile(join(root,f),'utf8')).replaceAll('\r\n','\n');
  if (assetPrefix) {
    text = text.replaceAll('/assets/', `${assetPrefix}/assets/`);
    for (const sheet of ['styles.css','booking.css','theme-tokens.css','accommodation.css','hospitality.css']) text = text.replaceAll(`href="/${sheet}"`, `href="${assetPrefix}/${sheet}"`);
    text = text.replace('src="/app.js"', `src="${assetPrefix}/app.js"`);
  }
  await writeFile(join(output,f),text);
}
await writeFile(join(root,'theme-tokens.css'),paletteStyles());
await writeFile(join(output,'theme-tokens.css'),paletteStyles());
await cp(join(root,'assets'), join(output,'assets'), { recursive: true });
const html = await readFile(join(output,'index.html'),'utf8');
const routes = [...Object.keys(pages), ...rooms.map(r=>`/rooms/${r.slug}`)];
for (const route of [...routes,...['fa','en','ar'].flatMap(locale=>routes.map(r=>`/${locale}${r === '/' ? '' : r}`))]) {
  if (route === '/') continue;
  const folder = join(output, route.slice(1));
  await mkdir(folder,{recursive:true});
  await writeFile(join(folder,'index.html'),html);
}
const manifest = {};
async function hashTree(folder, prefix = '') {
  for (const entry of await readdir(folder,{withFileTypes:true})) {
    if (entry.name === 'release-manifest.json') continue;
    const name = prefix + entry.name;
    if (entry.isDirectory()) await hashTree(join(folder,entry.name),name+'/');
    else manifest[name] = createHash('sha256').update(await readFile(join(folder,entry.name))).digest('hex');
  }
}
await hashTree(output);
await writeFile(join(output,'release-manifest.json'),JSON.stringify({ site:'damoon',contentMode:'DEVELOPMENT_WITH_CONCEPT_IMAGES',builtAt:new Date().toISOString(),files:manifest },null,2));
console.log(`Built ${routes.length} routes with /fa, /en and /ar aliases; no package installation required.`);
