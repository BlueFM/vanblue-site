+++
title = "Meta Integration-Enhanced Optimizer"
description = "Multi-order integral shaping of the loss with hypergradient-driven coefficient updates. Manuscript in preparation."
date = 2026-09-01
authors = ["Shunbao Zhang"]

[extra]
venue = "Manuscript in preparation"
+++
<!-- Ongoing work: keep this page qualitative until the numbers are final. -->

A single integral order only filters a bounded range of sharp minima. MIEO stacks several
integral orders to reshape the loss surface more aggressively and accumulates gradient
history, with per-order coefficients updated online by a hypergradient controller whose
direction is synthesised to suppress stale information.

Internal ablations cover coefficient-update rules (momentum smoothing versus moment
normalisation), the choice of integral order, two-dimensional loss-landscape simulations,
and loss-landscape reconstruction on ResNet, together with image classification,
self-supervised learning and causal language modelling.
