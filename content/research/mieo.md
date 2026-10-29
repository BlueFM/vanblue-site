+++
title = "MIE - meta integration-enhanced optimiser"
description = "Multiple integral orders over the gradient history, with coefficients updated by a hypergradient rule. Under review at IEEE Transactions on Cybernetics."
weight = 2

[extra]
paper = "/papers/meta-integration-enhanced-optimizer/"
+++
<!-- Under review. Keep numbers off this page until the paper is accepted. -->

DIESGD fixes the integral order at two, so it can only filter a limited band of sharp
minima - a local view of the optimisation problem. The MIE mechanism instead stacks
**multiple integral orders** over the gradient history, each reshaping the loss at its own
timescale and generating momentum that does not decay the way EMA momentum does.

The hard part is the coefficients. Their optimal values shift during training, a
feed-forward network per order does not scale, and independent integral terms let stale
information accumulate. MIE therefore updates the coefficients by a **hypergradient rule**
driven by the directional alignment between the instantaneous gradient and the historical
integral states.

Two theoretical results accompany the method: an escape-time approximation showing that
SGD with MIE leaves sharp minima faster, and local asymptotic stability of the dynamics via
Lyapunov analysis.

Submitted to IEEE Transactions on Cybernetics - see the
[paper page](/papers/meta-integration-enhanced-optimizer/).
