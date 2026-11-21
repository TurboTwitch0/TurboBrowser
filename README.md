# TurboBrowser

A responsive search homepage with a choice of DuckDuckGo, Google, Yahoo and Bing; Web, Images, Videos and News search; editable shortcuts; and a daily Wikipedia discovery feed with a saved reading list.

Searches open the selected provider directly in a new tab. TurboBrowser does not proxy or store search queries. Shortcuts, search preferences and saved articles stay in browser-local storage; there is no account, backend, paid API or cross-device sync. If a collection cannot read or write browser storage, search and discovery still work and that collection stays in memory for the rest of the visit. Reload after storage is available to read the latest permanent list; temporary changes are not written over changes made in another tab.

## Run locally

Serve this directory with any static server, for example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. There is no build step or package dependency. Use a server rather than opening `index.html` as a file, because discovery and JavaScript modules load over HTTP.

## Use

- Choose a search category and provider, type a query, then press Enter. Press `/` outside a text field or `Ctrl+K` / `Cmd+K` to focus search. Your provider and category are remembered; your query is not saved.
- Add up to eight shortcuts. Use **Edit** to change a shortcut's name or address in place, or remove it. Removal offers **Undo**, preserving newer shortcuts received from another tab.
- Bookmark an article, then open **Reading list** or **Saved** to return to it. The `#reading-list` link opens that view directly, and Back/Forward restores the selected reading view. Search saved titles, topics, descriptions and article types; removal offers **Undo**. Up to 100 articles are stored in the current browser.
- Use **Refresh** to reload the latest published Wikipedia picks. A failed refresh keeps loaded articles available, and older snapshots display a delayed-update notice.
- **Surprise me** searches the entered query or a suggested topic with the selected provider and category.
- **In focus** lets you browse real daily reading picks with Previous/Next buttons or Left/Right/Home/End when the stage or its navigation buttons are focused. Open the selected article or save it to the same reading list. Nothing advances automatically. Other daily picks stay in the grid below.

Collection changes re-read and merge the storage visible to each tab. Web Locks coordinate cooperating tabs where available, but cross-tab preservation remains best effort even with locks. Undo restores its removed item alongside newer data, and conflicting shortcut edits keep the draft open for review.

## Checks

Node.js 22 or later runs the dependency-free tests:

```sh
node --test tests/*.test.mjs
node --check app.js
```

The tests cover all 16 provider/category search routes, query encoding, safe URL handling, stored data validation, Wikipedia feed normalization, partial-feed recovery, request retries and serialized collection updates with storage failure/recovery. Browser checks should include delayed cross-tab events, queued writes, shortcut edit conflicts and dialog reopening, as well as provider keyboard controls, shortcut add/remove/persistence, reading list persistence, feed failure/retry, storage restrictions and mobile layout.

## Daily content refresh

GitHub Actions refreshes `daily-content.json` at 12:23 UTC each day and when the updater changes. The workflow can also be started from the repository's **Actions** tab. It runs feed tests before fetching Wikipedia's English featured feed, then commits to `main`. Connected Vercel projects deploy from that push.

If Wikipedia omits most-read data, the updater fills remaining slots with clearly labeled **In the news** and **On this day** articles from the same feed. Requests have timeouts and retry transient failures. A failed or empty response keeps the previous feed intact. Readable titles, descriptions and available Wikimedia thumbnails are included; each article links to its Wikipedia source. The displayed update date reflects the actual refresh, not a promise of current data.

To refresh manually:

```sh
node scripts/update-daily-content.mjs
```

## Publishing

The established public link is https://turbobrowserv2.vercel.app/. This repository uses its existing GitHub-to-Vercel connection. Push reviewed changes to `main`, then verify Vercel's status for that exact commit. Three existing Vercel projects are connected; preserve these connections and the public link.

## Visual identity

TurboBrowser uses a warm launchpad identity: cream `#F6F3EB`, ink `#1B2940`, Turbo orange `#F47732`, mint `#CFE9DA` and sand `#F7E8B2`. Cobalt `#275CD4` identifies keyboard focus. The original T and launch-arrow icon is retained. `brand.css` applies these shared tokens to the working product, dialogs, reading-list empty state, loading cards and recovery actions. Motion is limited to a short arrival, hover feedback and loading placeholders; reduced-motion preference disables it.

`showcase.css` adds an editorial Georgia italic accent, a dimensional shortcut composition and a reading stage with original CSS lighting/rings. `showcase.mjs` only controls the view of real feed entries; it owns no storage, network requests or autoplay. The stage has explicit touch-sized controls, visible focus and optional-image fallbacks. Touch and reduced-motion layouts flatten decorative depth; reduced motion also disables the brief user-triggered selection transition.

The product promise, “Make room for curiosity,” describes direct provider search, editable shortcuts and browser-local reading lists. No account or cross-device capability is implied. Reusable brand and launch assets are in the task's `outputs/turbobrowser-launch-kit` directory; the public social preview is `brand/social-preview.png`.

Legacy `ads.js` and `ads-config.js` are retained in the repository but are not loaded by the homepage. The homepage has no ad placements or advertising requests.
