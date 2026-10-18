import test from 'node:test';
import assert from 'node:assert/strict';
import { addTextSection, blankDraft, checkDraftMinimum, localized, setLocalized } from '../../../lib/hotel-cms/hotel-cms-editor.ts';

test('blank draft is explicitly empty and cannot be submitted accidentally', () => {
  const draft = blankDraft();
  assert.deepEqual(draft.media, []);
  assert.match(checkDraftMinimum(draft), /عنوان صفحه/);
});
test('required fields allow only a draft with explicit supplied text', () => {
  const draft = blankDraft();
  draft.content.title = {fa:'صفحه هتل'};
  draft.content.hero.heading = {fa:'عنوان'};
  draft.content.introduction.body = {fa:'معرفی واقعی'};
  assert.equal(checkDraftMinimum(draft), null);
});
test('editing one locale preserves all other translations and handles missing values', () => {
  const original = { fa: 'نام', en: 'Name' };
  const next = setLocalized(original, 'ar', 'اسم');
  assert.deepEqual(next, { fa: 'نام', en: 'Name', ar: 'اسم' });
  assert.deepEqual(original, {fa:'نام',en:'Name'});
  assert.equal(localized(next,'ar'),'اسم');
  assert.equal(localized(next,'fa'),'نام');
  assert.deepEqual(setLocalized(next, 'ar', ''), original);
});
test('new text section has a distinct key and ordering while preserving previous sections', () => {
  const content = blankDraft().content;
  const first = addTextSection(content);
  const second = addTextSection(first);
  assert.equal(first.sections.length, 1);
  assert.deepEqual(second.sections.map((s) => s.key), ['section-1','section-2']);
  assert.deepEqual(second.sections.map((s) => s.order), [0,1]);
  assert.deepEqual(content.sections, []);
});
test('sections can be reordered without changing content or visibility and new sections append', async () => {
  const { addSection, moveSection } = await import('../../../lib/hotel-cms/hotel-cms-editor.ts');
  let content = addSection(blankDraft().content, 'TEXT');
  content = addSection(content, 'FAQ');
  content.sections[0].body = { fa: 'approved text' };
  content.sections[1].visible = false;
  const moved = moveSection(content, 'section-2', -1);
  assert.deepEqual(moved.sections.slice().sort((a,b)=>a.order-b.order).map((section) => section.key), ['section-2', 'section-1']);
  assert.deepEqual(moved.sections.find((section) => section.key === 'section-1').body, { fa: 'approved text' });
  assert.equal(moved.sections.find((section) => section.key === 'section-2').visible, false);
  const appended = addSection(moved, 'TEXT');
  assert.equal(appended.sections.find((section) => section.key === 'section-3').order, 2);
  assert.equal(moveSection(content, 'section-1', -1), content);
});
test('cross-room image scope, duplicates, and missing image id reject local draft', () => {
  const draft = blankDraft();
  draft.content.title={fa:'نام'};draft.content.hero.heading={fa:'عنوان'};draft.content.introduction.body={fa:'معرفی'};
  draft.media=[{imageId:'image1',scope:'PROPERTY',roomTypeId:'room1',slot:'GALLERY',sortOrder:0,altText:{fa:'اتاق'}}];
  assert.match(checkDraftMinimum(draft), /نباید شناسه اتاق/);
  draft.media[0].roomTypeId=null;
  draft.media.push({...draft.media[0],imageId:'image2'});
  assert.match(checkDraftMinimum(draft), /ترتیب تصاویر/);
  draft.media[1].sortOrder=1;draft.media[1].imageId='';
  assert.match(checkDraftMinimum(draft), /نمی‌تواند خالی/);
});
test('new text section requires content before saving a new version', () => {
  const draft = blankDraft();
  draft.content.title = {fa:'نام'};
  draft.content.hero.heading = {fa:'عنوان'};
  draft.content.introduction.body = {fa:'متن'};
  draft.content = addTextSection(draft.content);
  assert.match(checkDraftMinimum(draft), /بخش‌های اضافه‌شده/);
  draft.content.sections[0].body = {fa:'متن واقعی'};
  assert.equal(checkDraftMinimum(draft), null);
});

test('typed section factories support features and FAQ without changing prior content', async () => {
  const {addSection,addFeatureItem,addFaqItem}=await import('../../../lib/hotel-cms/hotel-cms-editor.ts');
  const base=blankDraft().content;
  const features=addSection(base, 'FEATURE_LIST');
  assert.equal(features.sections[0].kind,'FEATURE_LIST');
  const faq=addSection(features,'FAQ');
  assert.deepEqual(faq.sections.map(s=>s.key),['section-1','section-2']);
  const nextFeature=addFeatureItem(faq.sections[0]);
  assert.equal(nextFeature.items[0].key,'feature-1');
  const nextFaq=addFaqItem(faq.sections[1]);
  assert.equal(nextFaq.items.length,1);
  assert.deepEqual(base.sections,[]);
});
test('feature lists require heading and item labels', async () => {
  const {addSection,addFeatureItem}=await import('../../../lib/hotel-cms/hotel-cms-editor.ts');
  const draft=blankDraft();
  draft.content.title={fa:'نام'};draft.content.hero.heading={fa:'عنوان'};draft.content.introduction.body={fa:'معرفی'};
  draft.content=addSection(draft.content,'FEATURE_LIST');
  assert.match(checkDraftMinimum(draft),/عنوان بخش امکانات/);
  draft.content.sections[0].heading={fa:'امکانات'};
  draft.content.sections[0]=addFeatureItem(draft.content.sections[0]);
  assert.match(checkDraftMinimum(draft),/عنوان هر مورد/);
  draft.content.sections[0].items[0].label={fa:'پارکینگ'};
  assert.equal(checkDraftMinimum(draft),null);
});
test('FAQ requires both a question and answer but preserves translations', async () => {
  const {addSection,addFaqItem}=await import('../../../lib/hotel-cms/hotel-cms-editor.ts');
  const draft=blankDraft();
  draft.content.title={fa:'نام'};draft.content.hero.heading={fa:'عنوان'};draft.content.introduction.body={fa:'معرفی'};
  draft.content=addSection(draft.content,'FAQ');
  draft.content.sections[0]=addFaqItem(draft.content.sections[0]);
  assert.match(checkDraftMinimum(draft),/پرسش و پاسخ/);
  draft.content.sections[0].items[0].question={fa:'ساعت پذیرش؟',en:'Check-in time?'};
  draft.content.sections[0].items[0].answer={fa:'اطلاعات تأییدشده'};
  assert.equal(checkDraftMinimum(draft),null);
  assert.equal(draft.content.sections[0].items[0].question.en,'Check-in time?');
});
