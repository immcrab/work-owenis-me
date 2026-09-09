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
5. Uploads the result as a Pages artifact and deploys it.

Triggers: every 6 hours (`cron`), on push to `main`, and manually via
**Actions → Sync upstream & deploy to Pages → Run workflow**.

## DNS

`work.owenis.me` is a `CNAME` to `immcrab.github.io`.
