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
  Research Stories intro and the `[[extra.experience]]` list; the Markdown body
  stays the news list, one line per item.
- Selected Work, Research Stories, Projects and Beyond Research are pulled from
  `content/papers/`, `content/research/`, `content/projects/` and
  `content/share/` — adding a page there is enough for it to appear.
- `templates/index.html` fixes the section order; every `<section id>` is an
  anchor target, and the masthead highlights the section you are in.

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

A pixel creature sits in the bottom-right corner of every page. It is pure
canvas, no dependencies; mood comes from `/guardian/status.json`, a static file
rewritten once a minute by `guardian-status.timer` on the server:

| JSON `mood` | what the script sees                                      |
|-------------|-----------------------------------------------------------|
| `idle`      | default                                                   |
| `sleep`     | 01:00–07:00 server time                                   |
| `busy`      | load per core ≥ 0.7, or ≥ 20 visitors today                |
| `deploy`    | less than 120 s since `current` was swapped               |

If the file is missing — local preview, fresh clone — the creature falls back to
the visitor's clock and still animates. Click it for today's numbers.

Moods decide the face, not the legs: in `idle` and `deploy` it roams — walking
the floor at 24 px/s, climbing either wall at 40 px/s, pausing for a few seconds
between trips. `busy` and `sleep` stand still. Drag it and it follows the
pointer; let go in mid-air and it falls, or drop it against a wall and it clings
there, hands on the wall. Its eyes track the cursor when it comes close, and it
hops if you hover on it. `prefers-reduced-motion` keeps it parked in the corner
with no walk cycle at all.

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
