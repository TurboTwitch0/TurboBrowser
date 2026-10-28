# TurboBrowser

A responsive search homepage with a choice of DuckDuckGo, Google, Yahoo and Bing; Web, Images, Videos and News search; editable shortcuts; and a daily Wikipedia discovery feed with a saved reading list.

Searches open the selected provider directly in a new tab. TurboBrowser does not proxy or store search queries. Shortcuts, provider preference and saved articles stay in browser-local storage; there is no account, backend, paid API or cross-device sync. If storage is unavailable, search and discovery still work and changes last for the current visit.

## Run locally

Serve this directory with any static server, for example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. There is no build step or package dependency. Use a server rather than opening `index.html` as a file, because discovery and JavaScript modules load over HTTP.

## Use

- Choose a search category and provider, type a query, then press Enter. Press `/` outside a text field to focus search.
- Add up to eight shortcuts. Use **Edit** to remove a shortcut; the removal message offers **Undo**.
- Bookmark an article, then open **Reading list** or **Saved** to return to it. Up to 100 articles are stored in the current browser.
- **Surprise me** searches the entered query or a suggested topic with the selected provider and category.

## Checks

Node.js 22 or later runs the dependency-free tests:

```sh
node --test tests/*.test.mjs
node --check app.js
```

The tests cover all 16 provider/category search routes, query encoding, safe URL handling, stored data validation, Wikipedia feed normalization, partial-feed recovery and request retries. Browser checks should include provider keyboard controls, shortcut add/remove/persistence, reading list persistence, feed failure/retry, storage restrictions and mobile layout.

## Daily content refresh

GitHub Actions refreshes `daily-content.json` at 12:23 UTC each day and when the updater changes. The workflow can also be started from the repository's **Actions** tab. It runs feed tests before fetching Wikipedia's English featured feed, then commits to `main`. Connected Vercel projects deploy from that push.

If Wikipedia omits most-read data, the updater fills remaining slots with clearly labeled **In the news** and **On this day** articles from the same feed. Requests have timeouts and retry transient failures. A failed or empty response keeps the previous feed intact. Readable titles, descriptions and available Wikimedia thumbnails are included; each article links to its Wikipedia source. The displayed update date reflects the actual refresh, not a promise of current data.

To refresh manually:

```sh
node scripts/update-daily-content.mjs
```

## Publishing

This repository uses its existing GitHub-to-Vercel connection. Push reviewed changes to `main`, then verify Vercel's status for that exact commit. Multiple Vercel projects are connected; a canonical domain has not been documented here. Confirm domains in the existing Vercel project settings before adding canonical metadata.

Legacy `ads.js` and `ads-config.js` are retained in the repository but are not loaded by the homepage. The homepage has no ad placements or advertising requests.
