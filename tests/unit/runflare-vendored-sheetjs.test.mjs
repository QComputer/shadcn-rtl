import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);

test('SheetJS resolves to the same official archive in a checkout and the RunFlare COPY layer', () => {
  const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  assert.equal(manifest.dependencies.xlsx, 'file:vendor/xlsx-0.20.3.tgz');
  const relativePath = manifest.dependencies.xlsx.slice('file:'.length);
  const source = readFileSync(new URL(relativePath, root));
  // COPY package*.json prism[a] yarn.loc[k] /app/ flattens the prisma directory.
  const installLayer = readFileSync(new URL(`prisma/${relativePath}`, root));
  assert.deepEqual(source, installLayer);
  assert.equal(createHash('sha256').update(source).digest('hex'),
    '8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8');
});
