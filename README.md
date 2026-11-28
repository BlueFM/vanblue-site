# vanblue-site

Personal academic site for <https://vanblue.online> — papers, projects and CV.

Hand-rolled: Markdown content, plain HTML templates, no JavaScript framework,
no Node or Ruby toolchain. Built with Zola, served by nginx as flat files.

## Layout

    content/       Markdown + TOML front matter (papers, research, CV)
    templates/     HTML templates (Zola/Tera)
    static/        css, images, PDFs (copied verbatim)
    deploy/        deploy + rollback scripts, nginx config
    public/        build output — never edited by hand

## Theme

Narrow profile card on the left, one column of prose on the right, sticky
masthead above — the AcademicPages look (Trebuchet MS, 15px, `#494e52` on white,
links `#224b8d`) written as a single plain stylesheet, no Sass or JS build step.

    static/css/style.css             the whole theme, top to bottom in page order
    templates/partials/sidebar.html  profile card, link list, inline SVG icons

The home page is assembled from content rather than typed by hand:

- `content/_index.md` `[extra]` holds the bio, the research-interest chips, the
  Research Stories intro and the `[[extra.experience]]` list. The Markdown body is
  the News list and is empty on purpose; put a list back there and the section
  returns.
- Selected Work, Research Stories, Projects and Recommendations are pulled from
  `content/papers/`, `content/research/`, `content/projects/` and
  `content/share/` — adding a page there is enough for it to appear.
- `templates/index.html` fixes the section order; every `<section id>` is an
  anchor target, and the masthead highlights the section you are in.

## Share card

`python tools/make-og.py` redraws `static/img/og-cover.jpg`, the 1200×630 image
used by `og:image` on every page. The strings are at the top of that file; it
needs Pillow and the Trebuchet MS fonts that ship with Windows.

## Lab

`/lab/` draws two Gaussian wells and races four updates from one start — SGD,
SGDM, DIESGD and MIE — then reports the loss, the Hessian trace
and the step count where each one stops. `static/js/lab.js` holds the surface and
the update rules; the page's "The maths" panel spells them out. Dragging on the
canvas moves the start.

## CCF Deadlines

`/ccf-deadlines/` lists CCF-ranked AI, CV and NLP venues plus KDD, WSDM, CIKM and
ICDM. Everything is vendored — no request leaves the page at build or view time:

    python tools/sync-ccf.py      # refresh static/data/*.json from upstream

- `static/data/ccf-deadlines.json` — every deadline, loaded by `js/deadlines.js`
  for the filtering/sorting table on `/ccf-deadlines/`.
- `static/data/ccf-upcoming.json` — the next few, read at build time by the
  sidebar card in `templates/partials/sidebar.html`; `js/ddl-when.js` turns the
  printed dates into countdowns.
- `static/data/CCFDDL-LICENSE.txt` — the upstream MIT notice (keep it).

Upstream is <https://github.com/ccfddl/ccf-deadlines> (MIT). Re-run the sync
before a release if deadlines have moved; the page prints the sync date.

## Local preview

    ../.tools/zola.exe serve      # http://127.0.0.1:1111, live reload

## Build

    ../.tools/zola.exe build      # writes public/

## Deploy

Two paths, same server-side protocol:

    bash deploy/deploy.sh         # local: build, upload, atomic symlink swap, smoke test
    bash deploy/rollback.sh       # switch to the other release

Pushing to `main` also deploys, via `.github/workflows/deploy.yml`. CI builds with the
same Zola version and streams the output over SSH; the server side is the forced command
`/usr/local/bin/vanblue-receive`, so the deploy key can publish a release but cannot open
a shell. Set the `DEPLOY_SSH_KEY` repository secret to enable it — without the secret the
workflow builds and skips the deploy step instead of failing.

Releases live in `/var/www/vanblue/releases/<timestamp>`; `current` is a symlink,
so a deploy or rollback is a single atomic pointer change. The server keeps the
last 5 releases (`KEEP=5`).

## Site guardian

A small, purple-hatted wizard cat sits in the bottom-right corner of every page.
Its transparent WebP sprite atlas contains the supplied blink, breathing and walk
frames, plus a two-eared spell-casting pose repaired from the same character's
original ear artwork. Four finite SVG spells cycle without consecutive repeats:
a mint-green fish, golden stardust, a lilac moonshield and an occasional smoky
mishap. Each has its own shapes, motion, palette and caption; they share one cat
pose rather than downloading four new animations. No framework, external image
host, audio or AI call is involved.

- Click (or Enter/Space) for a spell and today's site numbers. Drag to move; a
  mid-air drop lands gently. Escape or a click outside closes the little card.
- Blinking keeps one fixed body image and replaces only two aligned, opaque eye
  patches. Blink updates do not clear or redraw the body, so frame-to-frame source
  lighting and WebP differences cannot make the hat, ears or silhouette flash.
- Quiet idle gestures use a shuffled seven-action bag: slow blink, double blink,
  curious head tilt, tail swish, stretch, shake and a brief doze. There are no
  consecutive repeats, no automatic cards and no extra image downloads. Head and
  tail gestures move clipped pieces of the same drawing; the eyes follow the
  moving head. The first gesture waits 6.5–11 s, then pauses are 13–26 s on desktop
  or 18–32 s on phones. Spells, dragging, hiding and keyboard focus interrupt them.
- On desktop, short strolls stay within 180 px of the cat's chosen spot, with
  16–30 s pauses. Hover, keyboard focus and an open card stop roaming. **Stay
  here** parks it; **Wander a little** lets it roam again.
- A permanent moon button stays in the bottom-right corner, independent of the
  cat's position. Click it to hide or show the cat; its label and expanded state
  follow visibility. There is no close button on the cat. On phones the cat is
  smaller and stays put. Hide and roam preferences are stored locally and survive
  navigation. Storage being blocked is harmless.
- `prefers-reduced-motion` uses still frames and a static, short-lived spell,
  without roaming or falling animation. Hidden tabs and a hidden cat stop the
  animation loop; status requests pause too. Printing excludes the companion.
- If the atlas fails, a separate still image is the fallback. With JavaScript
  disabled the widget stays hidden, and all site content remains available.

Mood still comes from `/guardian/status.json`, a static file rewritten once a
minute by `guardian-status.timer` on the server:

| JSON `mood` | what the script sees                                      |
|-------------|-----------------------------------------------------------|
| `idle`      | default; blinks and occasionally strolls                  |
| `sleep`     | 01:00–07:00 server time; curled up, breathing              |
| `busy`      | load per core ≥ 0.7, or ≥ 20 visitors today; stays nearby  |
| `deploy`    | less than 120 s since `current` was swapped               |

A missing, invalid or stale snapshot falls back to the visitor's clock. Clicking
wakes a sleeping cat for a spell without changing the server's status.

The widget lives in `templates/partials/guardian.html`, `static/js/guardian.js`
and `static/css/guardian.css`. To regenerate its optimized art from the original
animation package and the spell-casting illustration:

```bash
python tools/prepare-wizard-cat.py --source-zip /path/to/wizard-cat-pet-animation.zip --cast-image /path/to/casting.png
```

Install and tuning live in `deploy/guardian/README.md`. The snapshot deliberately
lives in `/var/www/vanblue/guardian/`, outside `releases/`, so deploys never
replace it; nginx serves it through an exact-match location.

## Server

- nginx 1.29, config in `/etc/nginx/conf.d/vanblue.conf` (copy: `deploy/nginx-vanblue.conf`)
- TLS: Let's Encrypt via certbot, auto-renewed by a systemd timer
- `www` and plain HTTP both 301 to `https://vanblue.online`

## Adding a paper

Create `content/papers/<slug>.md`:

    +++
    title = "..."
    description = "One-line summary."
    date = 2025-06-01
    authors = ["Your Name", "Coauthor"]
    [extra]
    venue = "..."
    doi = "10.xxxx/yyyy"
    pdf = "/papers/<slug>.pdf"
    bibtex = """..."""
    +++

Drop the PDF in `static/papers/`. The build emits `citation_*` meta tags so
Google Scholar indexes each paper as a separate entry.
