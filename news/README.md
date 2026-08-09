# Biopunk News

A Hacker News style link aggregator, reskinned and rebuilt for biotech: preprints, protocols,
open hardware, community labs, biosecurity, policy and funding — submitted, threaded and ranked
by the people doing the work.

Part of [biopunk.community](https://biopunk.community). Palette, type and attitude inherited from
the landing page: acid green on near-black, Courier, scanlines.

```
  ▲  BIO PUNK // NEWS        the revolution will not be peer reviewed
```

## Running it

Node 22.5 or newer. **No npm dependencies** — the database is Node's built-in `node:sqlite`,
the HTTP server is `node:http`, the templating is tagged template literals, password hashing is
`node:crypto` scrypt.

```bash
cd news
npm run seed     # optional: fictional sample feed to look at
npm start        # http://localhost:8787
npm test         # 52 tests, no network
```

| Command | What it does |
| --- | --- |
| `npm start` | Serve on `$PORT` (default 8787) |
| `npm run dev` | Same, with `--watch` reload |
| `npm run seed` | Seed sample content if the database is empty |
| `npm run reset` | Wipe and re-seed |
| `npm test` | Unit + HTTP integration tests |

Environment:

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` / `HOST` | `8787` / `0.0.0.0` | |
| `BIOPUNK_DB` | `./data/biopunk-news.db` | `:memory:` works for throwaway runs |
| `BIOPUNK_SECRET` | random per boot | Set it in production, or CSRF tokens rotate on restart |
| `NODE_ENV` | — | `production` adds `Secure` to the session cookie |

Seed logins are `<handle>` / `<handle>-demo-pass`, e.g. `helix_witch` / `helix_witch-demo-pass`.
All seeded stories and comments are **fictional sample data** written for local development.

## What it does

**Feed** — front page (ranked), new, best, Ask BN, Show BN, threads, per-channel feeds,
per-domain feeds, search, and an RSS feed of the front page.

**Voting** — one upvote per user per item, on stories *and* comments. Self-voting is refused;
un-voting gives the point and the karma back. Every point on the site is a real row in `votes`,
so counts cannot drift from reality. Votes go through `fetch` when JavaScript is on and through
an ordinary form POST when it is not.

**Discussion** — arbitrarily deep comment trees, ordered by score then time, with collapsing,
inline replies, permalinks, editing and soft delete (deleted comments keep their slot so the
tree does not lose its shape).

**Accounts** — handle + passphrase, scrypt-hashed. Sessions are opaque random tokens in an
`HttpOnly; SameSite=Lax` cookie. Every mutation carries a CSRF token derived from the session
via HMAC, so there is nothing extra to store. Profiles carry karma, an about box, and links to
submissions, comments and favorites.

**Moderation** — flagging, an auto-kill threshold, favorites, a two-hour edit/delete window,
an admin flag on users, and per-IP and per-user rate limits on signup, login, submissions,
comments and votes.

### Ranking

`src/rank.js`, deliberately small and unit-tested:

```
score = (points - 1 + 0.25 × comments) / (age_hours + 2) ^ 1.8
        × 0.5 ^ flags
        × 0.65 ^ (earlier stories from the same domain on the page)
```

The classic gravity curve, plus two changes that suit a biotech feed: discussion counts for
something (a preprint with a real methods argument under it beats a silent one), and repeats
from one outlet are demoted so a press-release factory cannot own the page. Ranking runs in JS
over a recent candidate pool rather than in SQL, which keeps the formula readable and testable.

## Layout

```
news/
├── server.js              HTTP bootstrap, graceful shutdown, session sweep
├── src/
│   ├── app.js             routing, page handlers, JSON API, RSS
│   ├── models.js          data layer: items, votes, comments, feeds, search
│   ├── db.js              SQLite schema + migrations + transactions
│   ├── rank.js            the ranking formula
│   ├── auth.js            scrypt hashing, sessions, CSRF
│   ├── http.js            send/redirect/body/static/rate-limit helpers
│   ├── util.js            escaping, html`` templating, time, URL handling
│   ├── seed.js            fictional sample content
│   └── views/             layout, components, pages (server-rendered)
├── public/                style.css, app.js, favicon
└── test/                  unit + integration tests
```

Pages are server-rendered strings. `public/app.js` is progressive enhancement only — async
voting, comment collapsing, inline reply boxes, live-updating timestamps. Everything works
with JavaScript disabled.

## API

Read endpoints are open and CORS-enabled; writes need a session cookie plus `X-CSRF-Token`.

```
GET  /api/stories?sort=top|new|best|ask|show&topic=&page=&limit=
GET  /api/item/:id          story (with its comment tree) or comment
GET  /api/user/:id          public profile
GET  /api/search?q=
GET  /api/topics
POST /api/vote              { id, dir: "up" | "down" }
POST /api/submit            { title, url?, text?, topic? }
POST /api/comment           { parent, text }
GET  /rss                   RSS 2.0 of the front page
GET  /health                liveness + counts
```

## Deploying

It is one Node process and one SQLite file. Anything that runs Node works — Fly, Railway,
Render, a $5 VPS:

```bash
NODE_ENV=production BIOPUNK_SECRET="$(openssl rand -hex 32)" \
BIOPUNK_DB=/data/biopunk-news.db PORT=8080 npm start
```

Put a TLS terminator in front of it, mount `/data` on a real volume (SQLite in WAL mode wants a
durable disk, not a container layer), and back the file up with `sqlite3 .backup`.

`docker build -t biopunk-news news/ && docker run -p 8080:8080 -v bpnews:/data biopunk-news`
also works — see the `Dockerfile`.

**Note on the rest of this repo:** the root `index.html` is the static biopunk.community landing
page served by GitHub Pages and is untouched by this app. Biopunk News needs a Node host, so it
cannot run on Pages. Once it has a home (`news.biopunk.community` is the obvious one), the
landing page nav takes one line:

```html
<a href="https://news.biopunk.community">News</a>
```

## Guidelines

Site rules live at `/guidelines`. The one with no discussion attached: no protocols, sequences
or acquisition routes for agents that could cause mass harm.
