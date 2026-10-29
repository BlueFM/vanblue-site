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

## Local preview

    ../.tools/zola.exe serve      # http://127.0.0.1:1111, live reload

## Build

    ../.tools/zola.exe build      # writes public/

## Deploy

    bash deploy/deploy.sh         # build, upload, atomic symlink swap, smoke test
    bash deploy/rollback.sh       # switch to the other release

Releases live in `/var/www/vanblue/releases/<timestamp>`; `current` is a symlink,
so a deploy or rollback is a single atomic pointer change. The server keeps the
last 5 releases (`KEEP=5`).

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
