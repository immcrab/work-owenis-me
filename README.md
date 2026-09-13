# work-owenis-me

Game router hosted at **https://work.owenis.me**.

A small static hub page linking out to game sites. Each entry has an "open"
button (counts a visit), and a like/dislike toggle. State lives in the
Firebase Realtime Database (project `owenisme-2e155`), read/written directly
from the browser (`assets/app.js`, loaded as an ES module) and gated by
`database.rules.json` — no backend server or functions involved.

## Data model (Realtime Database)

- `games/{slug}`: `name`, `description`, `url`, `category` (`Official` |
  `Unofficial`), `status` (`approved`), `submittedBy`, `visits`, `likes`,
  `dislikes`, `createdAt`.
- `votes/{anonId}/{slug}`: `1` (like) or `-1` (dislike) — one per browser
  (anon id is a random UUID in localStorage, same trust model as before).
- `submissions/{anonId}/{pushId}`: `{ url, slug, createdAt }`, used to
  rate-limit submissions to 5 per anon id per 24h (checked client-side —
  soft limit, not enforced by rules, same caveat as always: someone hitting
  the REST API directly could bypass it).

`database.rules.json` enforces the shape: a new `games/{slug}` node can only
be created with `category: "Unofficial"` (the four "Official" games were
seeded by hand via the Firebase CLI, which bypasses rules); once created,
`name`/`url`/`category`/`description`/`submittedBy` are immutable; `visits`
can only move up by exactly 1 per write, `likes`/`dislikes` by ±1 — matching
what the app's transactions actually do.

## Files

- `index.html` / `assets/style.css` / `assets/app.js` — the page.
- `.github/workflows/deploy.yml` — uploads the site as a Pages artifact on
  every push to `main`.
- `firebase.json` / `.firebaserc` / `database.rules.json` — Realtime
  Database config for this project directory.

## Adding an Official game

Add a node under `games/{slug}` via the Firebase console or CLI (client
writes can't set `category: "Official"`), and add the slug to
`OFFICIAL_ORDER` in `assets/app.js` so it sorts where you want:

```bash
npx firebase-tools database:set /games/<slug> - --project owenisme-2e155
```

(pipe in a JSON object with `name`, `description`, `url`, `category:
"Official"`, `status: "approved"`, `visits`/`likes`/`dislikes: 0`).

## Community submissions ("Unofficial")

The upload button next to the "Unofficial" heading opens a modal (name,
link, optional description, optional "By: username"). Submitting it writes
straight to `games/{slug}` client-side with `category: "Unofficial"` — no
review step, no AI check, it shows up immediately with the same
visit/like/dislike wiring as official games.

### Deploying rule changes

```bash
npx firebase-tools login
npx firebase-tools deploy --only database --project owenisme-2e155
```

## DNS

`work.owenis.me` is a `CNAME` to `immcrab.github.io`.

## Ghostlink

The ghostlink game (mirrored from upstream, ad-injected) used to live here —
it's now its own repo: [`immcrab/ghostlinkhub`](https://github.com/immcrab/ghostlinkhub),
deployed to `https://ghostlink.pxplay.top/`.
