+++
title = "PaperScorer — how predictable is paper acceptance?"
description = "Upload an anonymised submission and get the probability that it is accepted, from a vision model trained on OpenReview and arXiv."
date = 2026-10-29
weight = 1

[extra]
url = "https://paperscorer-ai.com/"
tags = ["peer review", "vision models", "research tool"]
+++

Sachin Konan, Jonathan Liu and Zhuang Liu (Princeton), NeurIPS 2026.

PaperScorer takes the anonymised PDF of a submission and returns an estimate of its chance
of acceptance — a number plus one of three labels (Leans Reject, Leans Accept, Likely
Accept). The model reads page images, so figures and layout count as much as the text does.

What makes it worth keeping is the question the authors ask: how *predictable* is acceptance
in the first place. Every prediction comes with a page explaining how much to trust it, and
the paper is public. Used that way it is a cheap sanity check on a draft — an early warning
that a paper reads thin — not a verdict on whether to submit.

Two things to keep in mind. The PDF is uploaded to someone else's server, so send the
anonymised version and nothing you are not ready to make public. And the site itself warns
that it is processing a lot of papers right now, so results can lag.

→ [paperscorer-ai.com](https://paperscorer-ai.com/)
