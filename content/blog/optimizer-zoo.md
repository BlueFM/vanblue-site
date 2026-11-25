+++
title = "How a machine finds the bottom of a hill"
description = "A neural network is trained by one humble rule: feel the slope, take a step, repeat. This is the story of how that rule got smarter, told in five pictures and no equations."
date = 2026-11-25

[extra]
reading_time = "12 min read"
+++

Imagine being dropped on a hillside in thick fog. You cannot see the valley, the river, or where
the ground flattens out. All you have is the ground under your feet: it slopes *this* way, so you
take a step *that* way, feel again, and repeat. Sooner or later you end up somewhere low.

That is how a neural network is trained, almost literally. The network is a pile of adjustable
numbers — call them knobs — and the "hillside" is a score that says how wrong the network is at
any setting of those knobs. Turn a knob a little, and the score changes. Your position on the
hillside is the current setting; the height is the error; and the slope you feel under your feet
is something engineers call the gradient. Training is walking downhill until you cannot go lower.

The knobs number in the millions, sometimes billions, so nobody can see the hillside. It has as
many dimensions as the network has knobs. All the model ever gets is a slope: which way is down,
from where it stands right now.

The rules for taking those steps are called **optimizers**, and the last sixty years of research
in this corner of machine learning is the story of making one humble instruction smarter:

> feel the slope, take a step, repeat.

Everything below is about the two things you can fiddle with in that sentence — *which way* and
*how far* — and about one thing that turns out to matter more than either: *which valley you end up
in*. The five figures are toy hillsides drawn for this post; the code that draws them is in the
site repository, and none of them is a measurement of a real network.

## The valley that makes walkers look silly

Start with the classic awkward case. Picture a long, narrow valley: steep walls on both sides, a
gentle slope along its length.

<figure>
  <img src="/img/blog/optimizers/fig1-zigzag.svg" width="720" height="300" loading="lazy"
       alt="A narrow valley seen from above, with two paths: one bounces from wall to wall while drifting forward, the other crosses once and settles.">
  <figcaption><strong>Figure 1.</strong> Two walkers on the same narrow valley, starting at the same
  place and taking 60 steps each. The orange path feels the slope and steps: its stride is fine
  across the valley but far too big for the walls, so it bounces from side to side and only creeps
  forward. The blue path rolls: it carries speed, crosses the valley once, and reaches the bottom in
  about twenty steps.</figcaption>
</figure>

The orange path is doing exactly what it was told, and it looks like a drunk crossing a corridor.
The problem is that one stride has to serve two jobs. Across the valley the ground is steep, so a
long stride overshoots and lands on the opposite wall. Along the valley the ground is almost flat,
so the same stride barely advances. Shorten it and the bouncing stops, but now you crawl forward
even more slowly. A step size that makes progress down the valley is already too big for its walls.

This is not a bug in the code. It is the shape of the problem, and every method below is a
different answer to it.

## Give the walker some momentum

The first fix is the one a child discovers on a sled. Stop re-deciding the direction from scratch at
every step; keep some of the last step's motion. Now the walker is a ball, and the ball's speed
accumulates whenever the slope keeps pointing the same way.

That is **momentum**, and it is old — Polyak described it in 1964, long before there were neural
networks to train with it. In Figure 1 the rolling walker is not smarter about the slope; it simply
does not throw away its speed. Along a long flat stretch, the small pushes add up instead of being
cancelled by a fresh start each time.

The price is the overshoot you can see at the bottom: a ball with speed does not stop neatly where
the ground flattens. Turn the momentum up and it goes faster and overshoots further; turn it down
and it behaves like a careful walker again. Every practical recipe is a compromise between those
two failures, and most people simply pick a middle value that works and stop thinking about it.

Momentum also does not solve the second half of the problem. It still gives every knob the same
stride.

## Every knob deserves its own stride

Real networks are not uniform. Some knobs are delicate: nudge one and the score jumps. Others are
sluggish: nudge one and almost nothing happens, so you need a big move to see any effect. A single
stride that suits the delicate knob will take years to move the sluggish one, and a stride that
suits the sluggish knob will wreck the delicate one.

The fix, from around 2011, was to give each knob its own stride, adjusted by how that knob has
behaved so far. If its slope has been large and jumpy, take smaller steps; if it has been small and
steady, take bigger ones. The version that ended up everywhere is called **Adam** (2014), and it
adds one more idea: keep a running average of the slope as well, so a single noisy reading does not
send the walker running in a random direction.

<figure>
  <img src="/img/blog/optimizers/fig2-scales.svg" width="720" height="400" loading="lazy"
       alt="Distance to the best answer against step number: one line stays flat near the top, the other falls steadily to about a tenth.">
  <figcaption><strong>Figure 2.</strong> One knob that is very sensitive, one that is barely
  sensitive, and two walkers. The grey line is a fixed stride: it collapses the sensitive knob in a
  couple of steps and then cannot budge the sluggish one, so its distance to the best answer stays
  stuck. Adam gives each knob its own stride and brings both down together.</figcaption>
</figure>

The grey line in Figure 2 is the frustrating part of the fixed stride: after a few steps it looks
like it has stopped making progress, and it has — in one direction it ran out of room, in the other
it barely moves. This mismatch is the everyday reason training stalls.

Adam's per-knob stride has a catch, and it is worth knowing because it explains a lot of odd
behaviour. Because the stride no longer shrinks when the slope shrinks, a knob whose slope has
become tiny still gets a normal-sized step. That is how it escapes a flat stretch instead of
stalling there — and also how, at the very end, it keeps hopping around the bottom of the valley
instead of settling. This is why everyone slows the stride down at the end of training: not because
the maths demands it, but because the walker will otherwise never stop fidgeting.

## The cold-start correction

One more small piece, because it is the sort of detail that quietly breaks things.

Adam keeps running averages of the slope, and running averages start empty. With nothing in them,
the first few readings are diluted by zero and the average looks much smaller than the truth. For
the score to behave, that early average has to be scaled up to compensate.

<figure>
  <img src="/img/blog/optimizers/fig3-bias.svg" width="720" height="360" loading="lazy"
       alt="Two curves rising from zero to one, and a dashed line at one labelled as the corrected average.">
  <figcaption><strong>Figure 3.</strong> An average of a constant signal, built from too few readings.
  The orange curve is the raw running average: it climbs slowly towards the true value and only gets
  there after dozens of steps. The blue dashed line is the same average with the cold start
  corrected, which puts it at the right value immediately. The slower the memory, the longer the
  wrong stretch — which is why the first few steps of a run are the ones most likely to go wrong.</figcaption>
</figure>

The fix is a small division, and it is in every modern implementation. It is the reason training
runs often begin with a gentle warmup instead of the intended stride: while the averages are still
being built, it pays to walk softly.

## It matters which bottom you reach

So far everything has been about getting down fast. For a model that will be used on data it has
never seen, the interesting question is *where* it ends up, because two bottoms can have almost
exactly the same height and behave very differently afterwards.

<figure>
  <img src="/img/blog/optimizers/fig4-minima.svg" width="720" height="400" loading="lazy"
       alt="Left: a wide shallow basin and a narrow deep one. Right: bars showing the narrow basin wins at the bottom but loses after a small nudge.">
  <figcaption><strong>Figure 4.</strong> Left: a slice through two places a walker can stop — a wide,
  shallow basin and a narrow, deep one. Right: the score at each bottom, and the score after nudging
  the position slightly, in every direction, as if the data shifted a little. The narrow basin wins
  outright at the bottom and loses after the nudge.</figcaption>
</figure>

The narrow groove is the show-off: the lowest point of all, perfect on the data you trained on. It
is also the fragile one. Nudge the knob settings a fraction and the score falls apart, because the
walls rise steeply on every side. The wide, shallow basin is a worse fit on paper and a much better
bet on anything new, because being a little off in any direction barely costs you.

This is the squishy centre of modern machine learning: a model that scores beautifully on its
training data and then fails on new data is often a model that got parked in a narrow groove. The
2016 finding that made this famous tied it to batch size — big-batch training tends to land in
narrower spots. Later work turned it into something you can optimize for directly: instead of
walking downhill on the plain hillside, walk downhill on the hillside as it looks after being
nudged, which prefers wide basins by construction.

Honest footnote: "wide" here is measured in the space of knobs, and knobs can be rescaled. Rescale a
layer's knobs and its walls change steepness without changing what the network computes at all. So
the idea is a useful map, not a law of nature, and the strongest evidence for it is practical: across
many settings, the methods that land in wide basins tend to hold up better on data they have not
seen.

## A short family album

Six entries, one per idea. No versions, no equations.

| Year | The new idea | What it fixed |
|------|--------------|---------------|
| 1964 | Let the walker roll | Stepping from a standstill is slow |
| 1983 | Look one step ahead | A rolling walker overshoots |
| 2011 | A separate stride per knob | Knobs differ wildly in sensitivity |
| 2014 | Both at once, plus a cold-start correction | Became the default answer |
| 2020 | Aim for wide basins, not just low points | The lowest point is not the safest |
| 2026 | Smooth the signal before walking (the work on this site) | Jitter drags models into narrow grooves |

## Listening more carefully

The last entry deserves a picture, because it is a different idea from all the ones before it.

All the walkers so far react to the slope they feel *right now*. But that reading is noisy: on a real
training run it jitters, and part of the jitter is exactly what pushes the walker into narrow,
fragile corners of the landscape. What if, instead of reacting to the latest reading, you react to a
smoothed version of the last few hundred?

<figure>
  <img src="/img/blog/optimizers/fig5-smoothing.svg" width="720" height="390" loading="lazy"
       alt="A jagged signal and two smoothed versions of it: one follows the trend loosely, the other much more smoothly.">
  <figcaption><strong>Figure 5.</strong> A made-up signal that a model might feel while training —
  a slow trend buried in fast jitter — and the same signal after one and after two smoothing stages.
  One stage (momentum) already helps. Two stages follow the trend and ignore the jitter almost
  entirely, at the cost of lagging a little behind it.</figcaption>
</figure>

One smoothing stage is momentum. Two stages in a row is a stronger filter, and that is the core of
the work on this site: rather than making the walker faster, make its sense of the ground steadier.
The first of the two methods fixes the amount of smoothing; the second lets it adapt during
training, judging how much to trust the smoothed signal by how well it lines up with what the
ground is saying now. If you want to play with it, [this page](/lab/) lets you drag the starting
point around and watch four walkers take the same hillside, and the two research notes have the
details: [one](/research/diesgd/), [two](/research/mieo/).

Whether smoother walking really does produce a wider basin is a claim to be tested, not a story to
be told, and the papers do the testing. What the picture offers is the intuition: the noise you are
reacting to is not neutral, and being deaf to part of it can change where you stop.

## What all this means outside a lab

Three things worth keeping, even if you never train a model yourself.

**No method is "just better".** Every one of these rules buys something and pays for it: momentum
buys speed and pays in overshoot; per-knob strides buy scale-independence and pay in fidgeting;
smoothing buys steadiness and pays in lag. When somebody announces that one of them "solves
optimization", what they usually mean is that it is a good trade for a particular kind of problem.

**Training is expensive, and the rules decide the bill.** Walking downhill sounds cheap, but you do
it billions of times, with millions of knobs, on hardware that costs real money and real electricity.
A rule that converges in half the steps is not a mathematical nicety; it is a data-centre bill.

**The last few percent are about robustness, not score.** The scores reported on the data you trained
with tell you how well the walker found a bottom. They tell you almost nothing about whether the
bottom will still be there when the world shifts slightly. That gap is where most of the practical
disappointment with machine learning lives.

## If you want to go deeper

- Kingma & Ba, [Adam](https://arxiv.org/abs/1412.6980) (2014) — the running-average idea that became
  the default.
- Keskar et al., [On large-batch training](https://arxiv.org/abs/1609.04836) (2016) — why big batches
  land in narrow grooves.
- Dinh et al., [Sharp minima can generalize](https://arxiv.org/abs/1712.09913) (2017) — the honest
  counter-argument to the whole story above.
- Foret et al., [SAM](https://arxiv.org/abs/2010.01412) (2020) — optimizing for the nudge as well as
  the point.
- Polyak, *Some methods of speeding up the convergence of iteration methods* (1964) — the original
  rolling walker.
