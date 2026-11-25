+++
title = "The optimizer zoo, drawn on one landscape"
description = "Momentum, adaptive step sizes, curvature and flat minima: a picture-heavy tour of what each optimizer in the standard toolbox actually buys you, and where the field is still guessing."
date = 2026-11-25

[extra]
reading_time = "17 min read"
+++

Pick any optimizer off the shelf — plain gradient descent, SGD with momentum, AdamW, or whatever
last week's paper recommended — and it is answering one of three questions: **which way to step**,
**how far to step**, and **what kind of minimum you want to land in**. The first two are geometry.
The third is where the field is still arguing, and where most of the interesting work happens now.

This post walks through the family in roughly historical order, one picture per idea. Every figure
is a toy problem computed for this post — a quadratic valley, two basins, a frequency response —
in `tools/make-blog-figures.py` in the site repository. They are meant to be read, not cited.

## The walk

Training is a walk downhill. Your parameters are a point θ in some very high-dimensional space,
the loss L(θ) is the height under your feet, and the gradient tells you which way is up. The oldest
update in deep learning, and still the reference point for everything else, is

<pre><code>θ ← θ − η ∇L(θ)</code></pre>

Two numbers decide everything: the direction −∇L(θ) and the length η. A neural network has tens of
millions to hundreds of billions of coordinates, so you will never see this surface; you only ever
probe it along one direction at a time. That is the whole reason the picture below matters.

<figure>
  <img src="/img/blog/optimizers/fig1-zigzag.svg" width="720" height="300" loading="lazy"
       alt="Two trajectories on an elongated valley. Gradient descent bounces from wall to wall and crawls along the floor; momentum crosses the valley once and settles at the bottom.">
  <figcaption><strong>Figure 1.</strong> Two optimizers on the same narrow valley, starting from the
  same point, for 60 steps. The contours are level sets of a quadratic whose curvature is 25 across
  the valley and 1 along it. Gradient descent (lr 0.07) overshoots the steep direction on every step;
  momentum (lr 0.08, β = 0.5) crosses the valley once and is done in about twenty steps.</figcaption>
</figure>

The zigzag is the single most useful picture in optimization. The curvature across this valley is
25 times the curvature along it. A step size is stable only while ηλ stays below 2 for every
curvature λ you own, so the steep direction sets an upper bound — here η < 0.08. But the progress
you make along the floor is proportional to ηλ_flat, which is tiny at that step size. So you pick a
step size at the edge of what the steep direction allows, the steep direction punishes you for it,
and the iterate alternates sign across the valley while creeping forward. A step size large enough
to make progress along the flat direction is already too large for the steep one.

None of this is a bug in your code. It is the conditioning of the problem, and it is what every
optimizer below is trying to fix.

## Momentum: break the coupling with memory

The first fix is to stop treating each step as an independent decision. Give the iterate a velocity:

<pre><code>v ← β v − η ∇L(θ)
θ ← θ + v</code></pre>

This is Polyak's heavy-ball method, from 1964 — older than the neural networks it now trains. The
intuition is physical: a ball rolling down a valley does not stop and re-decide direction at every
step; it carries speed. On a direction with small curvature the velocity accumulates, and the
effective step size becomes roughly η/(1−β). With the usual β = 0.9 that is a factor of ten, for
the cost of one extra buffer of the same size as the parameters.

In Figure 1 momentum gets one clean crossing instead of sixty small ones, because the accumulated
velocity carries it through the valley and the flat direction stops fighting it. The price is the
overshoot you can see: the ball crosses the floor and comes back. Tuning β is trading that overshoot
against speed; β close to 1 buys more acceleration and a longer bounce.

Nesterov's variant (1983) evaluates the gradient at the point you are *about to* reach instead of the
point you are at, which is like aiming ahead of a moving target. It costs the same and usually
converges a little sooner, and it is the "Nesterov" flag in every framework. The important thing for
this post is what momentum does *not* do: it still uses one η and one β for every coordinate, and it
still does not look at curvature. It makes the valley easier to walk, it does not reshape it.

## One step size per weight

Real networks break the assumption that all coordinates look alike. A weight in an early
convolution and a weight in an output embedding can see gradients and curvatures that differ by
orders of magnitude; the loss can be a beautifully conditioned bowl in one block and a flat plain in
another. Any single η is a compromise, and usually a bad one.

The adaptive family replaces the global step size with one per weight, by dividing the update by a
running estimate of how big that weight's gradients have been. AdaGrad (2011) accumulated the sum of
squared gradients; RMSProp (2012) replaced the sum with an exponential average, so the denominator
can shrink again; Adam (2014) added a first-moment term — momentum — and a bias correction, and
became the default for everything that is not a convolutional network trained by someone with a
long weekend.

<figure>
  <img src="/img/blog/optimizers/fig2-scales.svg" width="720" height="400" loading="lazy"
       alt="Distance to the minimum against step number on a log scale. Gradient descent stays flat near one; Adam falls smoothly to about a tenth.">
  <figcaption><strong>Figure 2.</strong> Distance to the minimum for a quadratic whose two coordinates
  have curvatures 100 and 0.01, with the step size decayed by a cosine schedule for both methods.
  Gradient descent collapses the steep coordinate immediately and then cannot move the flat one:
  its error is stuck at 1, all of it in the direction it cannot see. Adam takes a step of roughly
  lr in each coordinate and brings both down together.</figcaption>
</figure>

Figure 2 is the case for adaptivity in one plot. Gradient descent's stable step size is capped at
2/100 = 0.02 by the steep coordinate; at that step size, the flat coordinate moves by 0.02 × 0.01 ×
θ per step, which is to say it does not move. Adam normalizes each coordinate by its own gradient
scale, so both fall at the same rate — the update becomes a step in *parameter* space of size ~η,
independent of curvature.

That scale invariance is the feature and the trap. Because Adam's step does not shrink when the
gradient shrinks, a coordinate whose gradient is a thousand times smaller gets the *same* step as
the loud ones. Good: it can still make progress. Bad: at the end of training it is also the
mechanism that turns label noise and numerical dust into a step of the same size as before. It is
also why an Adam learning rate rarely transfers between problems the way an SGD one does — the
number no longer means "how far down the loss".

## The two corrections that made Adam work

Adam's denominator is an average of squared gradients, and an average that starts empty is biased.
With a constant gradient of 1 and β₁ = 0.9, the first estimate is 0.1, not 1 — every early step is
smaller than it should be, by a factor that itself changes every step. The fix is a division by the
same missing mass:

<figure>
  <img src="/img/blog/optimizers/fig3-bias.svg" width="720" height="360" loading="lazy"
       alt="Two curves rising from zero to one, and a dashed line at one labelled after correction.">
  <figcaption><strong>Figure 3.</strong> The raw exponential average rises as 1 − β^t from zero;
  dividing by the same factor puts it at 1 immediately. The gap is mild for the first moment
  (β₁ = 0.9, the fast curve) and severe for the second (β₂ = 0.999, the slow one), which is why the
  first few hundred steps of an Adam run are the ones most sensitive to warmup.</figcaption>
</figure>

The second correction is not in the paper: AdamW (2017) moved weight decay out of the gradient and
applied it directly to the weights. The difference is subtle and matters. If you fold decay into the
gradient, the adaptive denominator divides it too — so a weight with a large gradient is decayed
*less* than a quiet one, exactly backwards. Decoupling it means decay applies uniformly, which is
what the regularization was supposed to do. Together with learning-rate warmup, AdamW is the reason
the standard recipe for transformers looks the way it does.

## What the loss does not tell you

Everything so far was about reaching a minimum fast. But for a network, the interesting question is
which minimum you reach, because the value of the loss there is not what you are graded on.

<figure>
  <img src="/img/blog/optimizers/fig4-minima.svg" width="720" height="400" loading="lazy"
       alt="Left: a one-dimensional slice with a wide shallow minimum and a narrow deep one. Right: bars showing the sharp basin is better at the minimum but worse after weight jitter.">
  <figcaption><strong>Figure 4.</strong> Left: a slice through two minima, one wide with curvature
  ~0.1, one narrow with curvature ~1.8. Right: the loss at each minimum, and the loss averaged over
  Gaussian weight jitter (σ = 0.35, computed by quadrature). The sharp basin wins on the training
  loss and loses once the weights are perturbed, which is the toy version of why the curvature at
  the endpoint is worth caring about.</figcaption>
</figure>

This is the sharp-versus-flat story, and it has survived fifteen years of scrutiny in a form close to
the one in Figure 4: two points with nearly the same training loss, different curvature, different
behaviour under the tiny perturbations that separate training from test. Keskar and colleagues made
it concrete in 2016 by tying sharp minima to large batch sizes; SAM in 2020 took the next step and
optimized the loss at a perturbed point directly, which is flatness as an explicit objective.

It is worth being honest about what is not settled. Flatness as measured in parameter space depends
on the parameterization: rescale the weights of one layer and its curvature changes without changing
the function at all. So "flat" is best read as a property of *this* endpoint under *this*
parameterization, and the claims that survive are empirical — optimizers that land in flatter
regions tend to transfer better across datasets in practice. That is a weaker statement than the
papers sometimes make, and a more useful one.

## Ten waypoints

The whole family, in order, with the one thing each added. Two of the last three are the reason this
page exists; more on those below.

| Year | Optimizer | What it added | Family |
|------|-----------|---------------|--------|
| 1964 | Heavy ball | velocity: the past keeps pushing | inertia |
| 1983 | Nesterov | look ahead before stepping | inertia |
| 2011 | AdaGrad | one step size per weight, from gradient history | adaptive |
| 2012 | RMSProp | forget that history exponentially | adaptive |
| 2014 | Adam | first and second moments, bias-corrected | adaptive |
| 2017 | AdamW | weight decay decoupled from the adaptive step | adaptive |
| 2020 | SAM | optimize the loss at a perturbed point | curvature |
| 2023 | Lion | signed momentum, half the memory | adaptive |
| 2023–24 | Sophia, Shampoo, Muon | curvature or matrix structure at scale | curvature |
| 2026 | DIESGD, MIE | integrals of the gradient, coefficients learnt | integrals |

The recent entries in the last two rows are the interesting ones, and they are all variations on a
single move: stop treating the gradient as a vector to be rescaled and start treating the *history*
of gradients as a signal, or the parameters as a matrix with structure worth exploiting.

## Integrals: a different route to a flat basin

Momentum is one integral of the gradient, and one integral is already a filter. Integrate twice, and
you get a second-order low-pass: the slow, consistent part of the gradient passes through almost
unchanged, while the fast, jittery part — the part that pushes the iterate into the narrow, sharp
corners of the valley floor — is attenuated.

<figure>
  <img src="/img/blog/optimizers/fig5-lowpass.svg" width="720" height="390" loading="lazy"
       alt="Three curves falling with frequency, the higher orders falling much faster, shaded region on the right labelled fast sharp directions.">
  <figcaption><strong>Figure 5.</strong> Gain of one, two and three cascaded discrete integrations of
  the gradient, relative to the slowest frequency shown. Each extra integral adds roughly 20 dB per
  decade of suppression of the fast components. If sharp minima live at high frequency and flat ones
  at low frequency, this is the mechanism by which an integral update could prefer the latter.</figcaption>
</figure>

That is the intuition behind the two methods on this site. DIESGD fixes the order at two and learns
the four coefficients that weight the terms, offline, from the statistics of noisy gradients. MIE
stacks several integral orders, each filtering at its own timescale, and updates the coefficients
online by a hypergradient rule driven by the alignment between the instantaneous gradient and the
integral states — which is a way of asking the history "are you still pointing where the loss is
going down?"

Whether this actually flattens minima is a measurement, not an intuition, and both papers carry the
usual theoretical furniture: an escape-time argument that the update leaves sharp minima faster, and
a Lyapunov-style stability result for the local dynamics. If you want the geometry rather than the
prose, the [lab page](/lab/) lets you drag the starting point and watch four updates settle into
different minima on the same surface, and the two research pages have the details:
[DIESGD](/research/diesgd/) and [MIE](/research/mieo/).

## A field guide

Everything above in one list, for when you just need to train something.

- **Convolutional networks on images, small to medium data.** SGD with momentum, β = 0.9, step size
  scaled with batch size, weight decay ~5e-4, cosine or step decay to near zero. Still the most
  reliable recipe, and the flat-minima story was built on it.
- **Transformers, LLMs, anything with heavy-tailed gradients.** AdamW, β = (0.9, 0.95), warmup over
  the first 1–2% of steps, cosine decay to near zero, weight decay 0.1. The warmup is not cosmetic:
  it gives the second moment time to mean something before the step size is trusted.
- **Fine-tuning a pretrained model.** AdamW at 1e-5 to 1e-4, often without warmup, usually with
  weight decay off for the head.
- **When the endpoint matters more than the curve.** SAM-style updates, or an integral-type update,
  at roughly twice the compute per step. Worth it if you are chasing transfer instead of a leaderboard
  number on the training distribution.
- **Always.** Decay the step size to zero at the end. Figure 2's floor is real: a constant step size
  cannot resolve anything below itself, and the last few percent of loss live down there. And check
  that "the loss went to zero" is not hiding a coordinate that stopped moving.

## Three invariants

Strip away the branding and every optimizer in the zoo is a bet on which of three things is worth
modelling explicitly:

1. **Direction.** Momentum, Nesterov, integrals — all ways of using the past to pick a better vector
   than the raw gradient. Cheap, one buffer, usually the best ratio of gain to complexity.
2. **Step size.** AdaGrad, RMSProp, Adam — all ways of letting each coordinate pick its own. Buys
   scale invariance, costs you the meaning of the number.
3. **Curvature.** Shampoo, Sophia, SAM, DIESGD — all ways of noticing that the surface is not the
   same shape in every direction. Expensive, and the only family that can change *which* minimum you
   land in rather than how fast you get there.

The history of this field is less a history of new mathematics than of changing budgets: momentum
arrived when a buffer of the parameters was affordable, Adam when storing two more was, and the
curvature methods are arriving now because someone finally has the memory and the batch size to make
a second-order estimate pay for itself. If you are choosing an optimizer, you are really asking
which of these three you can afford today.

## Reading list

- Polyak, *Some methods of speeding up the convergence of iteration methods* (1964) — the heavy ball.
- Duchi, Hazan & Singer, [Adaptive subgradient methods](https://jmlr.org/papers/v12/duchi11a.html) (2011).
- Kingma & Ba, [Adam](https://arxiv.org/abs/1412.6980) (2014).
- Loshchilov & Hutter, [Decoupled weight decay regularization](https://arxiv.org/abs/1711.05101) (2017).
- Keskar et al., [On large-batch training](https://arxiv.org/abs/1609.04836) (2016) — sharp minima.
- Dinh et al., [Sharp minima can generalize](https://arxiv.org/abs/1712.09913) (2017) — the counter-argument.
- Foret et al., [SAM](https://arxiv.org/abs/2010.01412) (2020).
- Chen et al., [Lion](https://arxiv.org/abs/2302.06675) and Liu et al., [Sophia](https://arxiv.org/abs/2305.14342) (2023).
- Gupta et al., [Shampoo](https://arxiv.org/abs/1802.09568) (2018), and [distributed Shampoo](https://arxiv.org/abs/2309.06497) (2023) for the scale-up.
- Wilson et al., [The marginal value of adaptive gradient methods](https://arxiv.org/abs/1705.08292) (2017) — why adaptive is not free.
