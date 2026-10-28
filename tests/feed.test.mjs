import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContent, fetchFeaturedFeed, normalizeArticle } from '../scripts/update-daily-content.mjs';

const now = new Date('2026-10-27T12:23:00Z');
const article = (title) => ({ title, extract: `About ${title}`, content_urls: { desktop: { page: `https://en.wikipedia.org/wiki/${title}` } } });

test('uses readable titles and only safe Wikipedia links and images', () => {
  const result = normalizeArticle({
    ...article('Second_Battle_of_Newtonia'),
    content_urls: { desktop: { page: 'javascript:alert(1)' } },
    thumbnail: { source: 'https://example.com/tracker.png' },
  }, 'Featured article');
  assert.equal(result.title, 'Second Battle of Newtonia');
  assert.equal(result.url, 'https://en.wikipedia.org/wiki/Second_Battle_of_Newtonia');
  assert.equal(result.thumbnail, undefined);
  assert.equal(normalizeArticle({}, 'Most read'), null);
  assert.equal(normalizeArticle({ ...article('Moon'), thumbnail: { source: 'https://upload.wikimedia.org/moon.jpg' } }, 'Most read').thumbnail, 'https://upload.wikimedia.org/moon.jpg');
});

test('caps articles at seven, deduplicates and preserves featured first', () => {
  const result = buildContent({ tfa: article('Moon'), mostread: { articles: [article('Moon'), ...Array.from({ length: 10 }, (_, i) => article(`Article_${i}`))] } }, now);
  assert.equal(result.items.length, 7);
  assert.equal(result.items[0].kind, 'Featured article');
  assert.equal(new Set(result.items.map((item) => item.url)).size, 7);
  assert.equal(result.updatedAt, now.toISOString());
});

test('fills a partial feed with accurately labeled news and history', () => {
  const result = buildContent({
    tfa: article('Moon'),
    news: [{ links: [article('News')] }],
    onthisday: [{ pages: [article('Moon'), article('History')] }],
  }, now);
  assert.deepEqual(result.items.map((item) => item.kind), ['Featured article', 'In the news', 'On this day']);
  assert.deepEqual(result.items.map((item) => item.title), ['Moon', 'News', 'History']);
  assert.throws(() => buildContent({}), /no usable discovery articles/);
});

test('retries a temporary API failure and requests the expected UTC date', async () => {
  let requests = 0;
  const delays = [];
  const result = await fetchFeaturedFeed(now, {
    fetchImpl: async (url, options) => {
      assert.match(url, /\/2026\/10\/27$/);
      assert.ok(options.signal instanceof AbortSignal);
      requests++;
      return requests === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ tfa: article('Moon') }) };
    },
    sleep: async (ms) => delays.push(ms),
  });
  assert.equal(result.tfa.title, 'Moon');
  assert.equal(requests, 2);
  assert.deepEqual(delays, [1000]);
});

test('does not retry a permanent API error', async () => {
  let requests = 0;
  await assert.rejects(fetchFeaturedFeed(now, {
    fetchImpl: async () => { requests++; return { ok: false, status: 404 }; },
    sleep: async () => assert.fail('A permanent error must not be retried'),
  }), /404/);
  assert.equal(requests, 1);
});
