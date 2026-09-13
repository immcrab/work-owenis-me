# work-owenis-me

Game router hosted at **https://work.owenis.me**.

A small static hub page linking out to game sites. Each entry has an "open"
button (counts a visit), and a like/dislike toggle. State is stored in
Supabase (table `games` for counts, `game_votes` for one vote per
`(anon_id, game_slug)` pair) via two RPC functions (`record_visit`,
`cast_vote`) — the anon key can only call those functions, not touch the
tables directly.

## Files

- `index.html` / `assets/style.css` / `assets/app.js` — the page.
- `.github/workflows/deploy.yml` — uploads the site as a Pages artifact on
  every push to `main`.

## Adding a game

Add an entry to the `GAMES` array in `assets/app.js` and a matching row in
the `games` table (`slug`, `name`, `url`). These show under "Official".

## Community submissions ("Unofficial")

The upload button next to the "Unofficial" heading opens a small modal.
Submitting it calls the `submit_game` Postgres RPC (same pattern as
`record_visit`/`cast_vote` — anon key can call the function, not write to
`games` directly), which validates the name/URL, rate-limits to 5
submissions per anon id per 24h, and inserts the row straight in with
`category = 'Unofficial'`, `status = 'approved'`. No review step — it shows
up immediately with the same visit/like/dislike wiring as official games.
Every attempt is logged in `game_submission_log` for the rate limit.

### Deploying schema changes

```bash
npx supabase login
npx supabase link --project-ref qlehylbpigveqtcmidfm
npx supabase db push
```

## DNS

`work.owenis.me` is a `CNAME` to `immcrab.github.io`.

## Ghostlink

The ghostlink game (mirrored from upstream, ad-injected) used to live here —
it's now its own repo: [`immcrab/ghostlinkhub`](https://github.com/immcrab/ghostlinkhub),
deployed to `https://ghostlink.pxplay.top/`.
