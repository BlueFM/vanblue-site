+++
title = "Vanblue Tarot — draw a card, ask a question"
description = "A 78-card Rider–Waite reading site: server-side crypto draw, streamed LLM interpretation, an open card-meaning dataset, and a rule-based fallback when the model is down."
date = 2026-11-03
weight = 2

[extra]
tech = ["React", "Vite", "Node.js", "node:sqlite", "DeepSeek API", "SSE", "nginx", "systemd"]
live = "https://tarot.vanblue.online"
+++

Write down one thing you cannot think straight about, draw one to five Rider–Waite cards, and see
how a language model takes it apart. Built in November 2026; I still use it once or twice a week.

## Why its own subdomain

The main site is pure static — having no application layer is a deliberate trade. A tarot site has
to hold an API key, so it needs a server process, which is the first time I gave on that rule. The
compromise is to keep the concession boxed in: its own subdomain, its own systemd unit, a process
that listens on `127.0.0.1` only, and nginx as the single public surface. If the tarot service
misbehaves, `systemctl stop tarot` stops the bleeding and the academic homepage never notices.

## The draw is not in the browser

If the browser picks the cards, the reading is only as trustworthy as an animation. So the draw
happens server-side: `crypto.randomInt` with rejection sampling, 34% reversed, the result written
to SQLite, and `drawId` — not the card images — is the input to interpretation. The front end only
turns the cards over.

## The meanings are imported, not written

All 78 meanings come from an open dataset (Liz-van/divination-skills, MIT), whose keywords trace
back to Waite's *The Pictorial Key to the Tarot* (1911, public domain) via ekelen/tarot-api. An
import script turns the upstream JSON into `data/cards.json`, shared by client and server, and
validates every card: a missing field, a meaning shorter than 40 characters, or a duplicate id
fails the build.

The scans are Rider–Waite–Smith: public domain in the US, contested in the EU. The footer credits
them, and a commercial version should switch to a deck with clearer provenance.

## The prompt is part of the product

The model only sees the cards that were drawn, never the full deck. The system prompt fixes a few
things: do not paraphrase the given meanings, no horoscope-style platitudes, treat Death, Tower and
Devil as change rather than disaster, no predictions about illness or investments, reversals are
not bad news, and the output shape is fixed (per card → together → things to try). If the question
mentions work, study or supervisors, the career dimension is attached; if it mentions a partner,
the relationship dimension is. Both come from the dataset, not from the model's imagination.

## Three layers of fallback

If the model errors, a local rule-based reading takes over. If the API is absent entirely (pure
static hosting), the browser draws and the same rules write the reading. Both fallbacks are labelled
in the UI, so nobody mistakes rule output for a model.

## Things that bit me

- **nginx buffers upstream responses by default**, which turns SSE into "wait six seconds, then
  everything at once". With `proxy_buffering off` the first byte lands in 0.11 s.
- **The SQLite file initially lived inside a release directory**, so the next deploy switched the
  symlink and the history "vanished". It now sits in `/var/lib/tarot`, outside the release tree.
- **The systemd unit pointed at `/usr/bin/node`** while Node was installed in `/usr/local/bin`; the
  service restarted in a 203/EXEC loop until the path was fixed.
- **The model sometimes puts `## 逐张` and the first card on one line**, separated by a single
  newline. A block-based Markdown renderer glued them together and leaked the `**`. The renderer now
  parses line by line and forces headings into their own block.

## Cost and limits

A reading costs roughly 1.2k input and 0.6k output tokens; usage is stored per row so it can be
audited later. Limits: 20 readings per IP per day, 4 per minute, 400 per day across the site.

## It also lives in a chat group

An AstrBot plugin (`/塔罗 三牌 <question>`) runs inside the bot container. Token-bearing bot requests
are metered per sender, so a whole group does not share the server's single IP allowance.

## The three additions

- **Follow-ups**: after a reading you can keep asking, up to five rounds. A follow-up stays
  inside the same spread and never re-draws; it also costs one reading, so it can answer
  "so what do I actually do" rather than start a new session.
- **Share image**: a 1080×1350 card with the cards, the synthesis paragraph and the source. It is
  drawn with canvas in the browser, so the server never produces an image file.
- **One draw per day**: asking for a single card twice on the same day returns the same card.
  The card stays put and the reading can be re-read — the draw is a ritual, not a refresh button.

Next: bring the follow-ups and the image into the chat group (both need separate bot work), and
give the records a retention policy.
