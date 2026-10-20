# TurboBrowser

A small, responsive search homepage. Searches are sent to DuckDuckGo; TurboBrowser does not proxy or store search queries.

## Run locally

From the repository root, start a static file server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The page has no build step or package dependencies.

## Enable ads

TurboBrowser includes two Google AdSense placements. To show ads and earn revenue, you need your own AdSense account, an approved live site/domain, and an ad unit for each placement. Approval and payouts are handled by Google; adding these placements alone does not generate income.

After AdSense approves the site and provides your publisher ID and ad unit IDs, put those public IDs in `ads-config.js` under `publisherId`, `slots.search`, and `slots.footer`. Publish the updated site. Follow AdSense's instructions to add the required `ads.txt` record and any consent disclosures for your audience. Do not add passwords or API tokens to the site.
