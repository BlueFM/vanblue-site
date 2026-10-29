+++
title = "Improving Generalization through a Meta Integration-Enhanced Mechanism"
description = "Replacing EMA momentum with multiple integral neurodynamics of historical gradients, plus hypergradient-updated integral coefficients."
weight = 3
authors = ["Shunbao Zhang"]

[extra]
venue = "Submitted to IEEE Transactions on Cybernetics"
status = "Under review"
# NOTE: Submitted manuscript. Abstract and results summarised from MIE_final_version.pdf.
# NOTE: Author list is not reproduced here while the submission is under review.
+++
**TL;DR** - Exponential-moving-average momentum forgets old gradients, so it cannot sustain
the directional push needed to climb out of a sharp minimum. Stacking integral orders over
the gradient history keeps that push alive, and the integration coefficients can be updated
online by a hypergradient rule.

## Problem

Flat minima correlate with better generalisation, and EMA-based momentum is the standard
mechanism used to reach them. But historical gradient information decays rapidly under an
EMA, which prevents the accumulation of the sustained directional signal required to escape
a sharp minimum.

## Approach

We reformulate the optimizer as a neurodynamic system with integral feedback. The
meta-integration-enhanced (MIE) mechanism replaces EMA momentum with **multiple integral
neurodynamics of the historical gradients**: each additional integration order further
deforms the loss landscape and generates sustained momentum.

The integration coefficients are not fixed schedules. A **hypergradient meta-optimization**
rule updates them adaptively, driven by the directional alignment between the instantaneous
gradient and the historical integral states.

## Theory

- An **escape-time approximation** showing that SGD equipped with MIE escapes sharp minima
  faster than its momentum counterpart.
- **Local asymptotic stability** of the MIE dynamics, established by Lyapunov analysis.

## Results

Simulations and experiments across multiple datasets show that MIE-based optimizers achieve
better optimisation and generalisation than the baselines.

*Full manuscript available on request while the submission is under review.*
