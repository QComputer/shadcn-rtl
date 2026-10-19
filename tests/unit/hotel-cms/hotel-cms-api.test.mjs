import test from 'node:test';
import assert from 'node:assert/strict';
import { createHotelCmsApi, HotelCmsRequestError } from '../../../lib/hotel-cms/hotel-cms-api.ts';
const scope = { organizationId: 'org A', propertyId: 'hotel/1' };
const base = '/api/organizations/org%20A/hotels/hotel%2F1/website';
function fake(handlers) {
  const calls = [];
  const fetchImpl = async (url, request) => {
    calls.push({ url, request });
    return handlers(url, request, calls.length);
  };
  return { calls, fetchImpl };
}
const json = (data, status = 200) => Response.json(data, { status });

test('GET revisions uses exact C1B1 route with credentials, no-store and no mutation key', async () => {
  const { fetchImpl, calls } = fake(async () => json([{ revisionId: 'r1', revisionNumber: 2, status: 'DRAFT', content: { title: {}, hero: {}, introduction: {}, sections: [], contact: {} }, reviews: [], publications: [] }]));
  const api = createHotelCmsApi(scope, { fetchImpl });
  assert.equal((await api.listRevisions())[0].revisionId, 'r1');
  assert.equal(calls[0].url, `${base}/revisions`);
  assert.equal(calls[0].request.credentials, 'same-origin');
  assert.equal(calls[0].request.cache, 'no-store');
  assert.equal(calls[0].request.headers['Idempotency-Key'], undefined);
});
test('approved media GET uses tenant-scoped CMS route without mutation headers', async () => {
  const { fetchImpl, calls } = fake(async () => json([{ imageId: 'image-a', src: '/uploads/a.jpg', filename: 'a.jpg', mimeType: 'image/jpeg', createdAt: '2026-10-18T00:00:00Z' }]));
  const api = createHotelCmsApi(scope, { fetchImpl });
  assert.equal((await api.listAvailableMedia())[0].imageId, 'image-a');
  assert.equal(calls[0].url, `${base}/media`);
  assert.equal(calls[0].request.method, 'GET');
  assert.equal(calls[0].request.cache, 'no-store');
  assert.equal(calls[0].request.headers['Idempotency-Key'], undefined);
});
test('POST sends C1A content/media shape and stable actor-bound idempotency key after transport error', async () => {
  const { fetchImpl, calls } = fake(async (_, __, index) => {
    if (index === 1) throw new Error('network dropped after commit');
    return json({ result: { id: 'rev1', status: 'DRAFT' }, replayed: true }, 201);
  });
  const api = createHotelCmsApi(scope, { fetchImpl, keyFactory: () => 'cms-fixed-identity-123' });
  const draft = { content: { title: { fa: 'هتل' }, hero: { heading: { fa: 'دامون' } }, introduction: { body: { fa: 'معرفی' } }, sections: [], contact: {} }, media: [] };
  await assert.rejects(() => api.createDraft(draft), /network dropped/);
  const response = await api.createDraft(draft);
  assert.equal(response.replayed, true);
  assert.equal(calls[0].request.headers['Idempotency-Key'], calls[1].request.headers['Idempotency-Key']);
  assert.deepEqual(JSON.parse(calls[1].request.body), draft);
  assert.equal(calls[1].url, `${base}/revisions`);
});
test('POST retains its key when a successful HTTP response has an unreadable body', async () => {
  const { fetchImpl, calls } = fake(async (_, __, index) => index === 1
    ? new Response('not-json', { status: 201 })
    : json({ result: { id: 'rev1' }, replayed: true }, 201));
  const api = createHotelCmsApi(scope, { fetchImpl, keyFactory: () => 'cms-stable-body-retry-123' });
  const draft = { content: { title: { fa: 'هتل' }, hero: { heading: { fa: 'عنوان' } }, introduction: { body: { fa: 'متن' } }, sections: [], contact: {} }, media: [] };
  await assert.rejects(() => api.createDraft(draft), /JSON|Unexpected/);
  await api.createDraft(draft);
  assert.equal(calls[0].request.headers['Idempotency-Key'], calls[1].request.headers['Idempotency-Key']);
});
test('changed payload gets a distinct idempotency identifier', async () => {
  let count = 0;
  const { fetchImpl, calls } = fake(async () => json({ result: { status: 'IN_REVIEW' }, replayed: false }));
  const api = createHotelCmsApi(scope, { fetchImpl, keyFactory: () => `cms-generated-${++count}` });
  await api.submit('revision', 'first');
  await api.submit('revision', 'second');
  assert.notEqual(calls[0].request.headers['Idempotency-Key'], calls[1].request.headers['Idempotency-Key']);
  assert.equal(calls[0].url, `${base}/revisions/revision/submit`);
});
test('approval, publication, revocation use correct routes and bodies', async () => {
  const { fetchImpl, calls } = fake(async () => json({ result: {}, replayed: false }));
  const api = createHotelCmsApi(scope, { fetchImpl, keyFactory: () => 'cms-unique-key-valid-123' });
  await api.decide('revision', 'APPROVED', 'ok'); await api.publish('revision'); await api.revoke('pub-id', 'end');
  assert.equal(calls[0].url, `${base}/revisions/revision/review`);
  assert.deepEqual(JSON.parse(calls[0].request.body), { decision: 'APPROVED', note: 'ok' });
  assert.equal(calls[1].url, `${base}/revisions/revision/publish`);
  assert.deepEqual(JSON.parse(calls[1].request.body), {});
  assert.equal(calls[2].url, `${base}/publications/pub-id/revoke`);
  assert.deepEqual(JSON.parse(calls[2].request.body), { reason: 'end' });
});
test('preview rejects response without correct mode/scope and keeps locale', async () => {
  const { fetchImpl } = fake(async () => json({ mode: 'PUBLISHED', locale: 'fa', revisionId: 'rev', media: [] }));
  const api = createHotelCmsApi(scope, { fetchImpl });
  await assert.rejects(() => api.preview('rev', 'fa'), /Invalid preview response/);
});
test('404 and 403 result in bounded Persian error and do not surface database internals', async () => {
  const { fetchImpl } = fake(async () => json({ error: 'DB PRIVATE SECRET' }, 403));
  const api = createHotelCmsApi(scope, { fetchImpl });
  await assert.rejects(() => api.listRevisions(), (error) => {
    assert.ok(error instanceof HotelCmsRequestError);
    assert.equal(error.status, 403);
    assert.doesNotMatch(error.message, /SECRET|PRIVATE/);
    return true;
  });
});
test('invalid scope rejected before fetch', () => {
  assert.throws(() => createHotelCmsApi({ organizationId: '', propertyId: 'x' }), /Trusted Hotel scope/);
});
test('history uses expected reviews/publications and rejects malformed response', async () => {
  const { fetchImpl } = fake(async () => json({ reviews: [], publications: [] }));
  assert.deepEqual(await createHotelCmsApi(scope, { fetchImpl }).history(), { reviews: [], publications: [] });
  const bad = fake(async () => json({ data: [] }));
  await assert.rejects(() => createHotelCmsApi(scope, { fetchImpl: bad.fetchImpl }).history(), /Invalid content history/);
});
