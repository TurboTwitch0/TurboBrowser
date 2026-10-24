# TurboBrowser

A small, responsive search homepage. Searches go directly to your selected provider; TurboBrowser does not proxy or store queries. The homepage also features Wikipedia articles refreshed daily by GitHub Actions.

## Run locally

From the repository root, start a static file server:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. The page has no build step or package dependencies.

## Enable ads

TurboBrowser includes two Google AdSense placements. To show ads and earn revenue, you need your own AdSense account, an approved live site/domain, and an ad unit for each placement. Approval and payouts are handled by Google; adding these placements alone does not generate income.

After AdSense approves the site and provides your publisher ID and ad unit IDs, put those public IDs in `ads-config.js` under `publisherId`, `slots.search`, and `slots.footer`. Publish the updated site. Follow AdSense's instructions to add the required `ads.txt` record and any consent disclosures for your audience. Do not add passwords or API tokens to the site.

## Daily content refresh

GitHub Actions fetches Wikipedia's English featured article and most-read pages every day at 12:23 UTC and updates `daily-content.json`. The workflow can also be started manually from the repository's **Actions** tab. Each refresh is committed to `main`; if the repository is connected to Vercel, that push starts a new deployment. GitHub Actions must be enabled, and the workflow needs permission to write repository contents.
