+++
title = "DIESGD - cascaded inertia optimiser"
description = "Neurodynamics-derived second-order inertia that steers training into flat minima."
date = 2026-02-18
weight = 1

[extra]
paper = "/papers/cascaded-inertia-sgd/"
+++
<!-- TODO: add a figure (architecture or loss landscape) under static/img/ and reference it here. -->

Standard momentum carries first-order history; it does not care whether the model settles
into a sharp or a flat basin.

DIESGD adds a **second integral term**: the gradient signal is integrated twice before
entering the update, which acts as a low-pass filter on the loss surface and removes the
sharp components that hurt generalisation. The four coefficients weighting these terms
are not hand-tuned - a small feed-forward network predicts them, trained offline on noisy
gradients through a neurodynamic error equation.

Published as [*Enhancing Generalisation via Cascaded Inertia SGD With Learnt
Hyperparameters*](/papers/cascaded-inertia-sgd/).
