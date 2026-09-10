# work-owenis-me

Game / link hub hosted at **https://work.owenis.me**.

The site is mirrored from an upstream project and published to GitHub Pages by
a scheduled GitHub Action — this repo stores no copy of it.

## How it works

`.github/workflows/deploy.yml`:

1. Clones [`virtuan4-max/ghostlinkhub`](https://github.com/virtuan4-max/ghostlinkhub).
2. Copies every file **except `vercel.json`** (its rewrites break the proxy on
   Pages).
3. Copies `ghostlinksinglefile.html` to `index.html` as the landing page.
4. Adds the `CNAME` file (`work.owenis.me`) and `.nojekyll`.
5. Runs `scripts/inject-ads.py` (see below).
6. Uploads the result as a Pages artifact and deploys it.

## Ads

`scripts/inject-ads.py` runs on every build, so the ad code survives each
6-hour resync of the upstream files:

- Adds `<meta name="google-adsense-account" content="ca-pub-3679522337620689">`,
  the AdSense loader and Auto Ads to every page `<head>`.
- Inserts two `<ins class="adsbygoogle">` units into every page `<body>`. The
  `data-ad-slot` is a placeholder — replace with real slot IDs from the
  AdSense dashboard, or rely on Auto Ads to fill.
- Un-blocks `googlesyndication.com` / `googleadservices.com` / `doubleclick.net`
  in the bundled service workers (upstream `sw.js` 204s them, which would stop
  any ad from loading).
- Injects `scripts/popunder.js`, which opens a sponsor page on ~1 in 3 button
  clicks, capped to once per 3 minutes. **Inert** unless the repo has an
  Actions **variable** `POPUNDER_URL` set (Settings → Secrets and variables →
  Actions → Variables). AdSense has no popunder URL — point this at a
  popunder-style network (Adsterra / PropellerAds / etc.).

Note: Google AdSense program policy forbids its ads in pop-ups/pop-unders and
forbids encouraging accidental clicks. Keep the popunder on a **separate**
network from `ca-pub-3679522337620689` or the AdSense account is at risk.

Triggers: every 6 hours (`cron`), on push to `main`, and manually via
**Actions → Sync upstream & deploy to Pages → Run workflow**.

## DNS

`work.owenis.me` is a `CNAME` to `immcrab.github.io`.
