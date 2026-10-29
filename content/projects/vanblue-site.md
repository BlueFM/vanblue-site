+++
title = "vanblue.online — personal academic site"
description = "Static site generator + nginx deployment pipeline, built from scratch."
date = 2026-10-29
weight = 1

[extra]
code = "https://github.com/yourname/vanblue-site"
+++
<!-- TODO: 占位内容，替换成你真实的项目描述。 -->

Hand-rolled static site: content in Markdown, templates in plain HTML, deployed
as pre-built files to a single VPS behind nginx with automated TLS.

- **Build**: Zola, single binary, no Node or Ruby toolchain on the server
- **Deploy**: build locally, stream the output over SSH into a timestamped
  release directory, swap a symlink for atomic rollback
- **Serving**: nginx, immutable cache headers on fingerprinted assets
