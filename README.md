# Renuka's CTF challenges

A static portfolio of the CTF challenges I wrote for ACM Cyber, hosted on GitHub Pages.
Every challenge is playable on the site, including the ones that originally needed a server.

## Layout

```
index.html, assets/        the portfolio page (renders challenges.json)
challenges.json            one entry per challenge: metadata, encoded flag, solution
challenges/<slug>/         the challenge as players saw it (pages + provided files)
emu/                       shims that let original server code run in the browser
vendor/                    sql.js (SQLite) and PGlite (PostgreSQL), compiled to WebAssembly
tools/add_challenge.py     imports a challenge folder and updates challenges.json
```

## Adding a challenge

```sh
python3 tools/add_challenge.py ~/cyber-challs-f26/cyber-gm/web/my-new-chall
```

That copies what players saw (pages, static files, everything under `provide:`) into
`challenges/<slug>/`, and adds or refreshes the entry in `challenges.json`: name, points,
category, description, the quarter it ran (from the folder name), the flag (lightly encoded),
and any `solve.*` file. Your original folder is only read.
Pass several folders if a challenge ran more than once, oldest first. Then write a short
`"solution"` in its `challenges.json` entry.

Left out on purpose: Docker and npm files, `challenge.yml` (its plaintext flag would spoil
things), solve scripts (they appear behind the reveal toggle instead), and server code that was
never handed to players.

### Challenges with a backend

GitHub Pages only serves files, so server logic is ported to run in the visitor's browser,
keeping the original code as intact as possible:

- **Express apps:** copy the routes from `app.js` into `challenges/<slug>/sw.js`, starting with
  `importScripts("../../emu/express-sw.js", "env.js");`. The route bodies stay unchanged; see
  `challenges/post-it/sw.js`. A service worker answers those routes, so players solve it with
  `fetch()` from the DevTools console, or by visiting a GET route in the address bar.
- **Flask + SQL apps:** write `challenges/<slug>/port.js` mirroring `app.py` with
  `emu/flask-lite.js`; see `challenges/flag-store-2/port.js`. Queries run on a real SQLite or
  PostgreSQL database in the page, so injections behave exactly like they did on the server.

Then re-run `add_challenge.py`, which keeps the port, generates `env.js` from the container's
environment, and adds the script tag to the page.

## Flags

`FLAG_MODE` at the top of `assets/site.js` controls flag display: `"reveal"` (behind a
toggle), `"open"`, or `"checker"` (players can check a guess, but the flag is never shown). Flags
are XOR+base64 encoded so they don't show up in view-source at a glance. That's not real
secrecy, since a static site has no secrets.

## Running locally

Service workers need http(s), so serve the folder rather than opening the file:

```sh
python3 -m http.server 8000   # then open http://localhost:8000/
```

## Replaced images

Some challenge pages hot-linked images that have since disappeared. Replacements live in
`challenges/<slug>/img/` (bot-lobby and gameing-session: the loot chest and ender chest).
Re-running `add_challenge.py` on those challenges restores the original `index.html`, so
re-apply the `img/...` src swaps afterwards.
