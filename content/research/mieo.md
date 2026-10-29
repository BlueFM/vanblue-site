+++
title = "MIEO - meta integration-enhanced optimiser"
description = "Stacking several integral orders, with coefficients updated online by a hypergradient controller."
date = 2026-09-01
weight = 2
+++
<!-- Ongoing. Keep this page factual; do not publish numbers that are not final. -->

DIESGD fixes the integral order at two, so it can only filter a limited band of sharp
minima - a local view of the optimisation problem. MIEO instead stacks **multiple
integral orders**, each reshaping the loss differently and accumulating gradient history
at its own timescale.

The hard part is the coefficients. Their optimal values shift during training, a
feed-forward network per order does not scale, and independent integral terms let stale
information accumulate. MIEO therefore differentiates through the update rule to obtain
hypergradients, synthesises their direction to suppress conflicting information, and
feeds the result to a controller that updates the coefficients online.

Ongoing ablations: coefficient-update rules, how many orders actually help, and
loss-landscape reconstruction on ResNet.
