import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareMedia } from '../sites/damoon/prepare-media.mjs';

test('media preparation preserves originals and concepts; pending media stays private and unpublished', async () => {
  const root = await mkdtemp(join(tmpdir(),'damoon-media-'));
  try {
    const input = join(root,'input'); await mkdir(input);
    const bytes = await readFile('sites/damoon/assets/room-concept-1.webp');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    await writeFile(join(input,'sample.webp'),bytes);
    const asset = {slot:'single',file:'sample.webp',sha256,subject:'Synthetic test fixture, not approved hotel photography',alt:{fa:'نمونه آزمون',en:'Test sample',ar:'عينة اختبار'},approval:{status:'PENDING'}};
    const manifestPath = join(input,'input.json');
    const save = assets => writeFile(manifestPath,JSON.stringify({schemaVersion:1,assets}));
    await save([asset]);
    const review = await prepareMedia({manifestPath,outputPath:join(root,'review')});
    assert.equal(review.status,'PREPARED_NOT_PUBLISHED'); assert.equal(review.activationPerformed,false);
    assert.equal(review.assets[0].approval.status,'PENDING'); assert.equal(review.requiresVisualReview,true);
    assert.deepEqual(await readFile(join(input,'sample.webp')),bytes);
    assert.deepEqual(await readFile(join(root,'review','single.webp')),bytes);
    assert.equal(review.assets[0].currentAsset,'room-concept-1.webp');
    await assert.rejects(prepareMedia({manifestPath,outputPath:join(root,'review')}),/EEXIST/);
    for (const invalid of [{...asset,sha256:'0'.repeat(64)},{...asset,slot:'../../public'},{...asset,file:'../sample.webp'},{...asset,approval:{status:'APPROVED'}},{...asset,alt:{en:'Only English'}}]) {
      await save([invalid]); await assert.rejects(prepareMedia({manifestPath,outputPath:join(root,'invalid')}));
      await assert.rejects(stat(join(root,'invalid')),/ENOENT/);
    }
    await save([{...asset,rights:'PUBLICATION_PERMITTED',approval:{status:'APPROVED',reference:'SYNTHETIC_TEST_ONLY',date:'2026-11-10'}}]);
    const approvedReview = await prepareMedia({manifestPath,outputPath:join(root,'approved-review')});
    assert.equal(approvedReview.status,'PREPARED_NOT_PUBLISHED'); assert.equal(approvedReview.activationPerformed,false);
    await writeFile(join(input,'fake.png'),'not an image');
    await save([{...asset,file:'fake.png'}]); await assert.rejects(prepareMedia({manifestPath,outputPath:join(root,'fake')}),/signature/);
    await save([asset,asset]); await assert.rejects(prepareMedia({manifestPath,outputPath:join(root,'duplicate')}),/duplicate/);
    await save([asset]); await assert.rejects(prepareMedia({manifestPath,outputPath:resolve('public/damoon-front/private-media')}),/outside the Git/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
