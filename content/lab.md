+++
title = "Lab"
description = "A toy loss landscape: gradient descent, heavy-ball momentum, DIESGD and MIE start from the same point and settle into different minima."
template = "lab.html"
+++
Two minima sit on this surface: a **sharp** well on the right, which reaches a lower training loss, and a **wide, flat** basin on the left. Four updates start from the same point and take the same number of steps — plain gradient descent, SGDM, a cascaded integral that low-passes the gradient (DIESGD), and three integral orders whose coefficients follow the hypergradient (MIE).

Drag the start anywhere on the surface, and use the buttons under the plot to show or hide each run. What matters is not who finishes first, but where each one ends up and what the Hessian says about it: the flat basin trades a little training loss for a much smaller curvature. That trade is what [DIESGD](/research/diesgd/) and [MIE](/research/mieo/) are built around.
