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

Anyone can submit a link via the form on the page. It's handled by the
`submit-game` Supabase Edge Function (`supabase/functions/submit-game`):

1. Takes a screenshot of the submitted URL via microlink.io.
2. Sends the screenshot to a vision model (Mistral Large 3) with a prompt
   asking whether the page looks like it's actually working.
3. If yes, inserts the game into `games` with `category = 'Unofficial'`,
   `status = 'approved'` (service role, bypasses RLS) — it then shows up
   under "Unofficial" and gets the same visit/like/dislike wiring as
   official games.
4. If no (or the screenshot fails), nothing is inserted; the submitter sees
   why.

Every attempt is logged in `game_submission_log`, which also caps
submissions at 5 per anon id per 24h.

### Deploying schema/function changes

```bash
npx supabase login
npx supabase link --project-ref qlehylbpigveqtcmidfm
npx supabase db push
npx supabase secrets set MISTRAL_API_KEY=<your key>
npx supabase functions deploy submit-game
```

## DNS

`work.owenis.me` is a `CNAME` to `immcrab.github.io`.

## Ghostlink

The ghostlink game (mirrored from upstream, ad-injected) used to live here —
it's now its own repo: [`immcrab/ghostlinkhub`](https://github.com/immcrab/ghostlinkhub),
deployed to `https://ghostlink.pxplay.top/`.
