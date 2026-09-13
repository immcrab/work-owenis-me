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
the `games` table (`slug`, `name`, `url`).

## DNS

`work.owenis.me` is a `CNAME` to `immcrab.github.io`.

## Ghostlink

The ghostlink game (mirrored from upstream, ad-injected) used to live here —
it's now its own repo: [`immcrab/ghostlinkhub`](https://github.com/immcrab/ghostlinkhub),
deployed to `https://immcrab.github.io/ghostlinkhub/`.
