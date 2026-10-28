import { rename, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const maxArticles = 7;

function safeUrl(value, allowedHosts) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname) || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function normalizeArticle(article, kind) {
  const title = (article?.titles?.normalized || article?.title || '').replaceAll('_', ' ').trim();
  if (!title) return null;
  const url = safeUrl(article.content_urls?.desktop?.page, ['en.wikipedia.org'])
    || `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_'))}`;
  const item = { kind, title, url };
  const description = article.extract || article.description;
  if (typeof description === 'string' && description.trim()) {
    item.description = description.trim().slice(0, 360);
  }
  const thumbnail = safeUrl(article.thumbnail?.source, ['upload.wikimedia.org', 'thumb.wikimedia.org']);
  if (thumbnail) item.thumbnail = thumbnail;
  return item;
}

export function buildContent(feed, now = new Date()) {
  const items = [];
  const seen = new Set();
  function add(article, kind) {
    if (items.length >= maxArticles) return;
    const item = normalizeArticle(article, kind);
    if (!item || seen.has(item.url)) return;
    seen.add(item.url);
    items.push(item);
  }

  add(feed?.tfa, 'Featured article');
  for (const article of feed?.mostread?.articles || []) add(article, 'Most read');
  // The daily feed sometimes has no readership data. Use other articles from
  // that same day's feed, with honest labels, to keep discovery useful.
  for (const story of feed?.news || []) {
    const article = story?.links?.find((link) => {
      const item = normalizeArticle(link, 'In the news');
      return item && !seen.has(item.url);
    });
    if (article) add(article, 'In the news');
  }
  for (const event of feed?.onthisday || []) {
    const article = event?.pages?.find((page) => {
      const item = normalizeArticle(page, 'On this day');
      return item && !seen.has(item.url);
    });
    if (article) add(article, 'On this day');
  }
  if (!items.length) throw new Error('Wikipedia returned no usable discovery articles. Existing content was kept.');

  return {
    source: 'Wikipedia',
    description: 'Featured articles, most-read pages, current events and moments from history, refreshed daily from Wikipedia.',
    updatedAt: now.toISOString(),
    items,
  };
}

export async function fetchFeaturedFeed(now, { fetchImpl = fetch, sleep = setTimeout } = {}) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '/');
  const endpoint = `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${date}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchImpl(endpoint, {
        headers: { 'User-Agent': 'TurboBrowser/1.0 (https://github.com/TurboTwitch0/TurboBrowser)' },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const error = new Error(`Could not fetch Wikipedia featured content: ${response.status}`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      return await response.json();
    } catch (error) {
      if (error.retryable === false || attempt === 2) throw error;
      await sleep(1000 * (attempt + 1));
    }
  }
}

async function refreshContent() {
  const now = new Date();
  const content = buildContent(await fetchFeaturedFeed(now), now);
  const target = new URL('../daily-content.json', import.meta.url);
  const temporary = new URL('../daily-content.json.tmp', import.meta.url);
  // Only replace the published feed after a complete, valid response is ready.
  await writeFile(temporary, `${JSON.stringify(content, null, 2)}\n`);
  await rename(temporary, target);
  console.log(`Wrote ${content.items.length} daily picks from Wikipedia.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await refreshContent();
}
