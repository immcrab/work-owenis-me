# work-owenis-me

Game / link hub hosted at **https://work.owenis.me**.

The site is a single HTML file pulled from an upstream project and published
to GitHub Pages by a scheduled GitHub Action — this repo stores no copy of it.

## How it works

`.github/workflows/deploy.yml`:

1. Downloads `ghostlinksinglefile.html` from
   [`virtuan4-max/ghostlinkhub`](https://github.com/virtuan4-max/ghostlinkhub).
2. Renames it to `index.html`.
3. Adds the `CNAME` file (`work.owenis.me`).
4. Uploads the result as a Pages artifact and deploys it.

Triggers: every 6 hours (`cron`), on push to `main`, and manually via
**Actions → Sync upstream & deploy to Pages → Run workflow**.

## DNS

`work.owenis.me` is a `CNAME` to `immcrab.github.io`.
