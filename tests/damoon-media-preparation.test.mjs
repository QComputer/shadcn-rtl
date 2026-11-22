import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareMedia, mediaReviewRoot } from '../sites/damoon/prepare-media.mjs';

test('Damoon media slot registry is explicit, responsive and keeps every replacement owner-pending', async () => {
  const registry = JSON.parse(await readFile('sites/damoon/media-slots.json','utf8'));
  assert.equal(registry.publicationStatus,'OWNER_INPUT_PENDING');
  assert.equal(registry.responsiveReview.format,'webp');
  assert.deepEqual(registry.responsiveReview.widths,[320,640,960,1280,1920]);
  assert.deepEqual(Object.keys(registry.slots).sort(),['architecture','cafe','double','gallery','hero','lobby','logo','restaurant','single','suite'].sort());
  for (const [slot, details] of Object.entries(registry.slots)) {
    assert.ok(details.placement,`${slot} has a named public placement`);
    assert.ok(details.sizes,`${slot} declares responsive display sizes`);
    assert.equal(details.approval,'PENDING',`${slot} remains unavailable for public replacement`);
    assert.ok(details.currentKind === 'CONCEPT' || details.currentKind === 'TEXT_MONOGRAM');
  }
});

test('media preparation preserves originals and concepts; pending media stays private and unpublished', async () => {
  await mkdir(mediaReviewRoot, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(join(mediaReviewRoot,'fixture-'));
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
    assert.equal(review.assets[0].approval.status,'PENDING'); assert.equal(review.requiresVisualReview,true); assert.equal(review.requiresMetadataReview,true);
    assert.equal(review.assets[0].placement,'Single room category');
    assert.match(review.assets[0].sizes,/max-width/);
    assert.ok(review.assets[0].responsive.length > 0, 'private review bundle includes generated responsive WebP variants');
    assert.deepEqual(review.responsiveProfile.widths,[320,640,960,1280,1920]);
    for (const variant of review.assets[0].responsive) {
      const variantBytes = await readFile(join(root,'review',variant.file));
      assert.equal(variantBytes.toString('ascii',0,4),'RIFF');
      assert.equal(variantBytes.toString('ascii',8,12),'WEBP');
      assert.equal(createHash('sha256').update(variantBytes).digest('hex'),variant.sha256);
      assert.equal(variant.bytes,variantBytes.length);
    }
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
    await save([asset]); await assert.rejects(prepareMedia({manifestPath,outputPath:resolve('public/damoon-front/private-media')}),/controlled review root/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
