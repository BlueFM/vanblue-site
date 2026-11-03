+++
title = "Vanblue Tarot — draw a card, ask a question"
description = "A 78-card Rider–Waite reading site: server-side draws, streamed LLM interpretation, follow-up questions, and a bot that works in chat."
date = 2026-11-03
weight = 2

[extra]
tech = ["React", "Vite", "Node.js", "DeepSeek API", "nginx"]
live = "https://tarot.vanblue.online"
+++

Write down one thing you cannot think straight about, draw one to five Rider–Waite cards, and see
how a language model takes it apart.

The draw happens server-side, the card meanings come from an open dataset, and the reading streams
in; if the model is unavailable the page falls back to a local rule-based reading instead of showing
nothing. You can keep asking follow-up questions, up to five rounds, and save the result as a
1080×1350 image. A single-card daily draw returns the same card for the rest of the day.

It also lives in chat: send `/塔罗 三牌 <question>` and the bot answers with a reading and an image.

The cards can only move your attention to the part you were walking around. They do not predict
illness, litigation or investment returns, and they should not make a decision for you.
