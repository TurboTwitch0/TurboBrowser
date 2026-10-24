import { writeFile } from 'node:fs/promises';

const date = new Date().toISOString().slice(0, 10).split('-');
const endpoint = `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${date.join('/')}`;
const response = await fetch(endpoint, {
  headers: {
    'User-Agent': 'TurboBrowser/1.0 (https://github.com/TurboTwitch0/TurboBrowser)',
  },
});

if (!response.ok) throw new Error(`Could not fetch Wikipedia featured content: ${response.status}`);
const feed = await response.json();

function articleUrl(article) {
  const page = article?.content_urls?.desktop?.page;
  if (page) return page;
  if (article?.title) return `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title.replaceAll(' ', '_'))}`;
  return null;
}

const articles = [];
if (feed.tfa?.title && articleUrl(feed.tfa)) {
  articles.push({ kind: 'Featured article', title: feed.tfa.title, url: articleUrl(feed.tfa) });
}

for (const article of feed.mostread?.articles || []) {
  if (!article?.title || !articleUrl(article)) continue;
  if (articles.some((item) => item.title === article.title)) continue;
  articles.push({ kind: 'Most read', title: article.title, url: articleUrl(article) });
  if (articles.length >= 7) break;
}

if (articles.length === 0) throw new Error('Wikipedia returned no usable featured or most-read pages.');

const content = {
  source: 'Wikipedia',
  description: 'Wikipedia’s featured article and most-read pages, refreshed daily.',
  updatedAt: new Date().toISOString(),
  items: articles,
};

await writeFile(new URL('../daily-content.json', import.meta.url), `${JSON.stringify(content, null, 2)}\n`);
console.log(`Wrote ${articles.length} daily picks from Wikipedia.`);
