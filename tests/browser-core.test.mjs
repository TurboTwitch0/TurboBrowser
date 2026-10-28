import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchUrl, normalizeUrl, normalizeArticle, normalizeShortcuts } from '../browser-core.mjs';

const routes = {
  duckduckgo: [
    ['https://duckduckgo.com/', 'q', null],
    ['https://duckduckgo.com/', 'q', ['ia', 'images']],
    ['https://duckduckgo.com/', 'q', ['ia', 'videos']],
    ['https://duckduckgo.com/', 'q', ['ia', 'news']],
  ],
  google: [
    ['https://www.google.com/search', 'q', null],
    ['https://www.google.com/search', 'q', ['tbm', 'isch']],
    ['https://www.google.com/search', 'q', ['tbm', 'vid']],
    ['https://www.google.com/search', 'q', ['tbm', 'nws']],
  ],
  yahoo: [
    ['https://search.yahoo.com/search', 'p', null],
    ['https://images.search.yahoo.com/search/images', 'p', null],
    ['https://video.search.yahoo.com/search/video', 'p', null],
    ['https://news.search.yahoo.com/search', 'p', null],
  ],
  bing: [
    ['https://www.bing.com/search', 'q', null],
    ['https://www.bing.com/images/search', 'q', null],
    ['https://www.bing.com/videos/search', 'q', null],
    ['https://www.bing.com/news/search', 'q', null],
  ],
};
const categories = ['web', 'images', 'videos', 'news'];

for (const [provider, expectedRoutes] of Object.entries(routes)) {
  categories.forEach((category, index) => {
    test(`${provider} ${category} search keeps the correct route and exact query`, () => {
      const [base, parameter, vertical] = expectedRoutes[index];
      const result = buildSearchUrl(provider, category, '  café & tea / 東京 + #1?  ');
      assert.equal(`${result.origin}${result.pathname}`, base);
      assert.equal(result.searchParams.get(parameter), 'café & tea / 東京 + #1?');
      assert.equal(result.hash, '');
      assert.equal(result.searchParams.size, vertical ? 2 : 1);
      if (vertical) assert.equal(result.searchParams.get(vertical[0]), vertical[1]);
    });
  });
}

test('unknown and inherited provider keys fall back to DuckDuckGo web search', () => {
  for (const provider of ['missing', '__proto__', 'constructor', 'toString', null, undefined]) {
    const result = buildSearchUrl(provider, 'unknown', 'test');
    assert.equal(result.href, 'https://duckduckgo.com/?q=test');
  }
});

test('invalid category cannot select an inherited route or carry over a vertical', () => {
  for (const category of ['__proto__', 'constructor', 'toString', null, undefined]) {
    assert.equal(buildSearchUrl('yahoo', category, 'test').href, 'https://search.yahoo.com/search?p=test');
    assert.equal(buildSearchUrl('google', category, 'test').href, 'https://www.google.com/search?q=test');
  }
});

test('URL normalization accepts explicit web addresses and optional bare hosts', () => {
  assert.equal(normalizeUrl(' https://example.com/a?q=1#next '), 'https://example.com/a?q=1#next');
  assert.equal(normalizeUrl('http://example.com'), 'http://example.com/');
  assert.equal(normalizeUrl('example.com/path'), null);
  assert.equal(normalizeUrl('example.com/path', true), 'https://example.com/path');
});

test('unsafe schemes, malformed URLs and embedded credentials are rejected', () => {
  for (const value of [null, undefined, 42, {}, '', ' ', 'not a domain', 'javascript:alert(1)', 'data:text/html,hello', 'file:///etc/passwd', 'mailto:hello@example.com', 'ftp://example.com', 'https://user:password@example.com', 'https://user@example.com', 'https://:password@example.com']) {
    assert.equal(normalizeUrl(value), null, String(value));
    assert.equal(normalizeUrl(value, true), null, `bare hosts enabled: ${String(value)}`);
  }
});

test('article normalization makes feed and saved entries readable and bounds optional fields', () => {
  const result = normalizeArticle({
    title: '  A_readable_title  ', url: 'https://en.wikipedia.org/wiki/A_readable_title',
    kind: 'K'.repeat(100), description: 'D'.repeat(500), thumbnail: { source: 'https://upload.wikimedia.org/example.jpg' },
  });
  assert.equal(result.title, 'A readable title');
  assert.equal(result.kind.length, 60);
  assert.equal(result.description.length, 400);
  assert.equal(result.thumbnail, 'https://upload.wikimedia.org/example.jpg');
  assert.equal(normalizeArticle({ title: 'T'.repeat(300), url: result.url }).title.length, 200);
});

test('malformed saved articles are discarded and unsafe optional media is ignored', () => {
  for (const value of [null, false, 3, 'article', {}, { title: 'Title' }, { title: '', url: 'https://example.com' }, { title: 123, url: 'https://example.com' }, { title: 'Title', url: 'javascript:alert(1)' }]) {
    assert.equal(normalizeArticle(value), null);
  }
  const result = normalizeArticle({ title: '<script>alert(1)</script>', url: 'https://example.com', kind: null, description: {}, thumbnail: 'javascript:alert(1)' });
  assert.equal(result.title, '<script>alert(1)</script>');
  assert.equal(result.kind, 'Wikipedia');
  assert.equal(result.description, '');
  assert.equal(result.thumbnail, null);
});

test('invalid stored shortcuts restore independent defaults while an empty list stays empty', () => {
  for (const value of [undefined, null, {}, 'bad data']) {
    const defaults = normalizeShortcuts(value);
    assert.equal(defaults.length, 4);
    defaults[0].name = 'Changed locally';
    assert.equal(normalizeShortcuts(value)[0].name, 'Wikipedia');
  }
  assert.deepEqual(normalizeShortcuts([]), []);
});

test('shortcut validation drops malformed entries, trims names and caps the list at eight', () => {
  const entries = [null, {}, { name: ' ', url: 'https://example.com' }, { name: 'Unsafe', url: 'data:text/html,test' }, { name: 'Credentials', url: 'https://user:password@example.com' }, ...Array.from({ length: 12 }, (_, index) => ({ name: `  ${'N'.repeat(40)} ${index} `, url: `https://example.com/${index}` }))];
  const shortcuts = normalizeShortcuts(entries);
  assert.equal(shortcuts.length, 8);
  assert.ok(shortcuts.every((item) => item.name.length === 32));
  assert.equal(shortcuts[0].url, 'https://example.com/0');
  assert.equal(shortcuts[7].url, 'https://example.com/7');
});
