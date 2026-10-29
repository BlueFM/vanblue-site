+++
title = "Enhancing Generalisation via Cascaded Inertia SGD With Learnt Hyperparameters"
description = "A second-order inertia term built from neurodynamics drives SGD toward flat minima, with its coefficients learned offline by a lightweight network."
date = 2026-02-18
authors = ["Yongji Guan", "Shunbao Zhang", "Longbang Wang", "Erchao Li"]

[extra]
venue = "CAAI Transactions on Intelligence Technology"
details = "Vol. 11, No. 4, pp. 1019-1027"
doi = "10.1049/cit2.70111"
bibtex = """
@article{guan2026enhancing,
  title   = {Enhancing Generalisation via Cascaded Inertia {SGD} With Learnt Hyperparameters},
  author  = {Guan, Yongji and Zhang, Shunbao and Wang, Longbang and Li, Erchao},
  journal = {CAAI Transactions on Intelligence Technology},
  volume  = {11},
  number  = {4},
  pages   = {1019--1027},
  year    = {2026},
  doi     = {10.1049/cit2.70111}
}
"""
+++
<!-- Author list, volume/pages and date verified against Crossref for this DOI. -->

**TL;DR** - Adding a second-order integral (cascaded inertia) term to SGD filters out
sharp minima during training, and the coefficients controlling it can be learned offline
by a small network rather than tuned by hand.

## Problem

Flat minima correlate with better generalisation and robustness, but plain SGD and
momentum methods offer no direct handle on the sharpness of the basin a model settles
into. Sharpness-aware methods pay for that control with extra forward/backward passes or
hand-tuned schedules.

## Approach

We model parameter training as a neurodynamic system and introduce a cascaded integral
inertia term. The integral operator low-passes the gradient signal, which in effect
removes sharp regions of the loss surface, while a lightweight feed-forward network -
trained offline on noisy gradients through a neurodynamic error equation - predicts the
four coefficients that govern the update.

## Results

Across image-classification and remote-sensing benchmarks the method improves on standard
baselines without extra per-step cost during training.
