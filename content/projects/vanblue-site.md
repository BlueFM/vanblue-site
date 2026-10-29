+++
title = "vanblue.online — personal academic site"
description = "A bilingual academic homepage built as flat files: Zola for the build, nginx for serving, and a deploy script that swaps symlinks atomically."
date = 2026-10-29
weight = 1

[extra]
tech = ["Zola", "Tera templates", "nginx", "Let's Encrypt", "bash", "DNS"]
live = "https://vanblue.online"
+++

This is the site you are reading. It exists to answer three questions about me — what I
publish, what I am working on, and how to reach me — and it is also the first project I
built end to end, from the DNS record to the TLS certificate.

## Constraints that shaped it

The server is a 2 vCPU / 1.7 GiB VPS that already runs other things, so the site has to
cost almost nothing at rest. That rules out WordPress and any other PHP stack: a database
plus a request-time interpreter is both the heaviest and the most attacked part of a small
server.

So the site is **flat files**. nginx serves pre-built HTML and holds about 10 MB of RSS
between requests; there is no application server and no database, so there is nothing that
can be turned into code execution.

## Stack

- **Build**: Zola, a single static binary — no Node, no Ruby, no dependency tree on either
  machine. A full rebuild of the site takes 30–200 ms.
- **Templates**: hand-written Tera templates, one file per page type, plus partials for the
  publication item, the author line and the project item.
- **Content**: Markdown with TOML front matter. Adding a paper means adding one file with
  its BibTeX; the page, the citation metadata and the list entry all follow from it.
- **Serving**: nginx with HTTP/2, gzip, HSTS, no-cache on HTML and a 30-day cache on
  assets. www and plain HTTP both 301 to the apex HTTPS origin.
- **TLS**: Let's Encrypt via certbot, renewed by a systemd timer, dry-run verified before I
  trusted it.

## Deployment

The server keeps timestamped release directories behind a single `current` symlink:

    /var/www/vanblue/releases/20261029-151210/
    /var/www/vanblue/releases/20261029-144446/
    /var/www/vanblue/current -> releases/20261029-151210/

`deploy/deploy.sh` builds locally, streams a tarball over SSH into a new release
directory, then swaps the symlink. Swapping a symlink is atomic, so no request is ever
served from a half-written directory, and **rolling back is pointing the link somewhere
else** — no rebuild, no re-upload, effective immediately. The script prunes to the last five
releases and finishes by fetching the live URL, failing the run if it does not return 200.

## Things that bit me

- **Zola silently drops pages from a section sorted by date when they have no date.** My
  in-preparation manuscript disappeared from the build behind a single warning line.
  Publication ordering is now explicit weights.
- **Zola 0.23's template engine rejects the import tag**, so macros are unavailable; shared
  markup lives in `templates/partials/` and is pulled in with include.
- **HTML comments in content files ship to production.** My editorial notes were readable
  in the live page source. They now live as TOML comments inside the front matter.
- **certbot renew looked hung.** It was not: non-interactive renewal sleeps a random 0–8
  minutes. Reading the log instead of waiting saved the confusion.
- **Disabling the Docker service does not stop Docker** while `docker.socket` is
  active — the next client command socket-activates the daemon straight back.

## Next

Publish the source, generate per-section feeds that respect the language, and move the
build into CI so a push republishes the site without a laptop in the loop.
