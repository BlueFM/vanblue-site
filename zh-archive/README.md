# Chinese version — kept, not published

Chinese translations of the site. They sit outside `content/` so Zola does not
build them; `https://vanblue.online/zh/` stopped being published on 2026-11-23.

This is not a Zola `content/` tree any more — the files still use the
`name.zh.md` naming so they can go straight back.

## Why outside `content/`

Zola only treats `page.zh.md` as the `zh` translation of `page.md` while a
`[languages.zh]` block exists in `config.toml`. Without it the file is built as
an ordinary page with the slug `page-zh`, which is exactly what we do not want.

## Bringing it back

1. `git mv` the files back under `content/` at the same relative paths.
2. Re-add `[languages.zh]` and `[languages.zh.translations]` to `config.toml`
   (the block that was removed is in `git log -p -- config.toml`).
3. Re-add an entry point: a language switch in `templates/base.html` or a plain
   link to `/zh/`.
