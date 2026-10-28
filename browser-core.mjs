export const providers = {
  duckduckgo: { name: 'DuckDuckGo', symbol: 'D', url: 'https://duckduckgo.com/', parameter: 'q', categories: { images: 'images', videos: 'videos', news: 'news' }, categoryParameter: 'ia' },
  google: { name: 'Google', symbol: 'G', url: 'https://www.google.com/search', parameter: 'q', categories: { images: 'isch', videos: 'vid', news: 'nws' }, categoryParameter: 'tbm' },
  yahoo: { name: 'Yahoo', symbol: 'Y', urls: { web: 'https://search.yahoo.com/search', images: 'https://images.search.yahoo.com/search/images', videos: 'https://video.search.yahoo.com/search/video', news: 'https://news.search.yahoo.com/search' }, parameter: 'p' },
  bing: { name: 'Bing', symbol: 'b', urls: { web: 'https://www.bing.com/search', images: 'https://www.bing.com/images/search', videos: 'https://www.bing.com/videos/search', news: 'https://www.bing.com/news/search' }, parameter: 'q' },
};
export const categoryNames = ['web', 'images', 'videos', 'news'];
export const defaultShortcuts = [
  { name: 'Wikipedia', url: 'https://www.wikipedia.org/' },
  { name: 'YouTube', url: 'https://www.youtube.com/' },
  { name: 'GitHub', url: 'https://github.com/' },
  { name: 'Gmail', url: 'https://mail.google.com/' },
];
export function buildSearchUrl(providerKey, category, query) {
  const provider = Object.hasOwn(providers, providerKey) ? providers[providerKey] : providers.duckduckgo;
  const chosenCategory = categoryNames.includes(category) ? category : 'web';
  const destination = new URL(provider.urls?.[chosenCategory] || provider.url);
  destination.searchParams.set(provider.parameter, String(query).trim());
  if (provider.categories?.[chosenCategory]) destination.searchParams.set(provider.categoryParameter, provider.categories[chosenCategory]);
  return destination;
}
export function normalizeUrl(value, allowBareHost = false) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let address = value.trim();
  if (allowBareHost && !/^[a-z][a-z\d+.-]*:/i.test(address)) address = `https://${address}`;
  try {
    const url = new URL(address);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
export function normalizeArticle(item) {
  if (!item || typeof item !== 'object') return null;
  const url = normalizeUrl(item.url);
  if (!url || typeof item.title !== 'string' || !item.title.trim()) return null;
  return { url, title: item.title.replaceAll('_', ' ').trim().slice(0, 200), kind: typeof item.kind === 'string' ? item.kind.slice(0, 60) : 'Wikipedia', description: typeof item.description === 'string' ? item.description.slice(0, 400) : '', thumbnail: normalizeUrl(typeof item.thumbnail === 'string' ? item.thumbnail : item.thumbnail?.source) };
}
export function normalizeShortcuts(items) {
  if (!Array.isArray(items)) return defaultShortcuts.map((item) => ({ ...item }));
  return items.flatMap((item) => {
    const url = normalizeUrl(item?.url);
    return url && typeof item?.name === 'string' && item.name.trim() ? [{ name: item.name.trim().slice(0, 32), url }] : [];
  }).slice(0, 8);
}
