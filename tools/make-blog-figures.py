#!/usr/bin/env python3
"""Generate the SVG figures for the blog post "The optimizer zoo".

The figures are written as plain SVG instead of being rendered by a plotting
library, so that typography (`Trebuchet MS`, the site font) and palette match
the site exactly and the files stay small and crisp at any zoom.

Everything drawn here is either analytic (quadratic basins, exponential
averages, discrete integrators) or simulated with numpy in this same file.
The post says which figures are toy problems.

    python tools/make-blog-figures.py
"""

from __future__ import annotations

import html
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "static" / "img" / "blog" / "optimizers"

INK = "#494e52"
MUTED = "#7a8288"
FAINT = "#b3b8bb"
RULE = "#e3e5e6"
GRID = "#f0f1f2"
BLUE = "#224b8d"
RUST = "#a8472c"
TEAL = "#2f6f6b"
SAND = "#9c8456"
GRAY = "#a2a8ac"
LIGHT = "#c8d2e0"

FONT = "'Trebuchet MS', Helvetica, Arial, sans-serif"


def mapper(a: float, b: float, lo: float, hi: float):
    """Linear map from data range [a, b] to pixel range [lo, hi]."""

    def f(v):
        return lo + (np.asarray(v) - a) / (b - a) * (hi - lo)

    return f


class Figure:
    """Minimal SVG canvas: enough primitives for these five figures."""

    def __init__(self, w: int, h: int):
        self.w, self.h = w, h
        self.parts: list[str] = []

    def add(self, markup: str) -> None:
        self.parts.append(markup)

    def line(self, x1, y1, x2, y2, stroke=RULE, width=1, dash=None, opacity=1.0):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        o = f' opacity="{opacity}"' if opacity != 1.0 else ""
        self.add(
            f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" '
            f'stroke="{stroke}" stroke-width="{width}"{d}{o}/>'
        )

    def poly(self, pts, stroke=INK, width=2, dash=None, opacity=1.0, cap="round"):
        d = "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        da = f' stroke-dasharray="{dash}"' if dash else ""
        o = f' opacity="{opacity}"' if opacity != 1.0 else ""
        self.add(
            f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{width}" '
            f'stroke-linecap="{cap}" stroke-linejoin="round"{da}{o}/>'
        )

    def circle(self, cx, cy, r, fill="none", stroke="none", width=1, opacity=1.0):
        o = f' opacity="{opacity}"' if opacity != 1.0 else ""
        self.add(
            f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" '
            f'stroke="{stroke}" stroke-width="{width}"{o}/>'
        )

    def rect(self, x, y, w, h, fill="none", stroke="none", width=1, rx=0, opacity=1.0):
        o = f' opacity="{opacity}"' if opacity != 1.0 else ""
        self.add(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{max(h, 0):.1f}" '
            f'rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"{o}/>'
        )

    def ellipse(self, cx, cy, rx, ry, stroke=RULE, width=1, fill="none", opacity=1.0):
        o = f' opacity="{opacity}"' if opacity != 1.0 else ""
        self.add(
            f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{width}"{o}/>'
        )

    def text(
        self,
        x,
        y,
        s: str,
        size: float = 13,
        fill: str = INK,
        anchor: str = "start",
        weight: str = "400",
        opacity: float = 1.0,
        style: str = "normal",
    ):
        size = 11.5 if size < 11 else size
        extra = ""
        if style != "normal":
            extra += f' font-style="{style}"'
        if opacity != 1.0:
            extra += f' opacity="{opacity}"'
        self.add(
            f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" '
            f'text-anchor="{anchor}" font-weight="{weight}"{extra}>'
            f"{html.escape(s)}</text>"
        )

    def rotated(self, x, y, s, size=11.5, fill=MUTED):
        self.add(
            f'<text x="0" y="0" font-size="{size}" fill="{fill}" text-anchor="middle" '
            f'transform="translate({x:.1f},{y:.1f}) rotate(-90)">'
            f"{html.escape(s)}</text>"
        )

    def save(self, name: str, title: str, desc: str) -> None:
        body = "\n".join(self.parts)
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" '
            f'width="{self.w}" height="{self.h}" role="img" aria-labelledby="t d">\n'
            f'<title id="t">{html.escape(title)}</title>\n'
            f'<desc id="d">{html.escape(desc)}</desc>\n'
            f"<style>text{{font-family:{FONT};}}</style>\n"
            f"{body}\n</svg>\n"
        )
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / name).write_text(svg, encoding="utf-8")
        print(f"wrote {name} ({(OUT / name).stat().st_size / 1024:.1f} kB)")


# ======================================================================
# figure 1 - zigzag vs. momentum, on a valley that runs left to right
# ======================================================================

STEEP, FLAT = 25.0, 1.0  # curvature across the valley (y) and along it (x)


def grad(p):
    return np.array([FLAT * p[0], STEEP * p[1]])


def run_gd(x0, lr, steps):
    xs = [np.asarray(x0, float)]
    x = xs[0].copy()
    for _ in range(steps):
        x = x - lr * grad(x)
        xs.append(x.copy())
    return np.array(xs)


def run_heavy_ball(x0, lr, beta, steps):
    xs = [np.asarray(x0, float)]
    x = xs[0].copy()
    v = np.zeros_like(x)
    for _ in range(steps):
        v = beta * v - lr * grad(x)
        x = x + v
        xs.append(x.copy())
    return np.array(xs)


def valley(fig: Figure, L, R, T, Bm, levels, xdom, ydom):
    """Contours of 0.5 * (FLAT x^2 + STEEP y^2); equal aspect on both axes."""
    xm = mapper(xdom[0], xdom[1], L, R)
    ym = mapper(ydom[0], ydom[1], Bm, T)
    cx, cy = xm(0), ym(0)
    for c in levels:
        rx = abs(xm(np.sqrt(2 * c / FLAT)) - cx)
        ry = abs(ym(np.sqrt(2 * c / STEEP)) - cy)
        fig.ellipse(cx, cy, rx, ry, stroke=RULE, width=1.1)
    fig.line(cx, T - 4, cx, Bm + 4, stroke=GRID, width=1)
    fig.line(L - 4, cy, R + 4, cy, stroke=GRID, width=1)
    return xm, ym


def fig_zigzag():
    W, H = 720, 300
    fig = Figure(W, H)
    L, R, T, Bm = 96, 690, 30, 232
    # equal aspect: 594 px / 7.06 units == 202 px / 2.4 units
    xdom, ydom = (-3.53, 3.53), (-1.2, 1.2)
    xm, ym = valley(fig, L, R, T, Bm, [0.4, 0.9, 1.6, 2.5, 3.6, 4.9], xdom, ydom)

    for v in [-3, -2, -1, 0, 1, 2, 3]:
        fig.line(xm(v), Bm + 5, xm(v), Bm + 9, stroke=FAINT, width=1)
        fig.text(xm(v), Bm + 21, str(v), size=10.5, fill=MUTED, anchor="middle")
    for v in [-1, 0, 1]:
        fig.line(L - 9, ym(v), L - 5, ym(v), stroke=FAINT, width=1)
        fig.text(L - 13, ym(v) + 3.6, str(v), size=10.5, fill=MUTED, anchor="end")
    fig.text((L + R) / 2, Bm + 42, "along the valley (flat curvature)", size=11.5,
             fill=MUTED, anchor="middle")
    fig.rotated(30, (T + Bm) / 2, "across the valley (steep curvature)")

    x0 = np.array([-3.45, 0.5])
    gd = run_gd(x0, 0.07, 60)
    hb = run_heavy_ball(x0, 0.08, 0.5, 60)

    fig.poly([(xm(p[0]), ym(p[1])) for p in gd], stroke=RUST, width=1.7, opacity=0.95)
    fig.poly([(xm(p[0]), ym(p[1])) for p in hb], stroke=BLUE, width=2.2)

    fig.circle(xm(x0[0]), ym(x0[1]), 4.4, fill=INK)
    fig.text(xm(x0[0]) + 8, ym(x0[1]) - 9, "start", size=11, fill=INK)
    fig.circle(xm(hb[-1][0]), ym(hb[-1][1]), 3.2, fill=BLUE)
    fig.circle(xm(gd[-1][0]), ym(gd[-1][1]), 3.0, fill=RUST)

    items = [
        ("gradient descent", "lr 0.07", RUST),
        ("momentum", "lr 0.08, beta 0.5", BLUE),
    ]
    for i, (name, note, color) in enumerate(items):
        y = Bm - 44 + i * 20
        fig.line(L + 4, y - 4, L + 22, y - 4, stroke=color, width=2.2)
        fig.text(L + 28, y, name, size=11.5, fill=INK, weight="700")
        fig.text(L + 140, y, note, size=10.8, fill=MUTED)

    fig.text(R, T, "60 steps each", size=10.8, fill=MUTED, anchor="end")

    fig.save(
        "fig1-zigzag.svg",
        "Gradient descent and momentum on an elongated valley",
        "On a narrow quadratic valley, gradient descent with a stable step size bounces "
        "across the valley at every step and then crawls along it, still 0.4 units from "
        "the bottom only after fifty-odd steps. Heavy-ball momentum at almost the same "
        "step size crosses the valley once and reaches the bottom in about twenty.",
    )


# ======================================================================
# figure 2 - two coordinates, two natural scales
# ======================================================================

def fig_scales():
    W, H = 720, 400
    fig = Figure(W, H)
    L, R, T, Bm = 96, 618, 44, 300
    xm = mapper(0, 100, L, R)
    ylo, yhi = np.log10(5e-4), np.log10(2.2)
    ym = mapper(ylo, yhi, Bm, T)

    for v in [2.0, 1.0, 0.1, 0.01, 0.001]:
        fig.line(L, ym(np.log10(v)), R, ym(np.log10(v)), stroke=GRID, width=1)
        fig.text(L - 10, ym(np.log10(v)) + 3.6, f"{v:g}", size=10.5, fill=MUTED,
                 anchor="end")
    for v in [0, 20, 40, 60, 80, 100]:
        fig.line(xm(v), Bm + 5, xm(v), Bm + 9, stroke=FAINT, width=1)
        fig.text(xm(v), Bm + 21, str(v), size=10.5, fill=MUTED, anchor="middle")
    fig.text((L + R) / 2, Bm + 42, "step", size=11.5, fill=MUTED, anchor="middle")
    fig.rotated(28, (T + Bm) / 2, "distance to the minimum (log scale)")

    a, b = 100.0, 0.01  # the two coordinates disagree by four orders of magnitude
    steps = 100

    x, y = 1.0, 1.0
    gd = []
    for t in range(1, steps + 1):
        gd.append(np.hypot(x, y))
        lr = 0.015 * np.cos(0.5 * np.pi * t / steps)
        x, y = x - lr * a * x, y - lr * b * y

    x, y = 1.0, 1.0
    m = np.zeros(2)
    v = np.zeros(2)
    adam = []
    for t in range(1, steps + 1):
        g = np.array([a * x, b * y])
        m = 0.9 * m + 0.1 * g
        v = 0.999 * v + 0.001 * g**2
        lr = 0.02 * np.cos(0.5 * np.pi * t / steps)
        x, y = (
            x - lr * m[0] / (1 - 0.9**t) / (np.sqrt(v[0] / (1 - 0.999**t)) + 1e-8),
            y - lr * m[1] / (1 - 0.9**t) / (np.sqrt(v[1] / (1 - 0.999**t)) + 1e-8),
        )
        adam.append(np.hypot(x, y))

    t = np.arange(1, steps + 1)
    fig.poly([(xm(tt), ym(np.log10(max(d, 1e-3)))) for tt, d in zip(t, gd)],
             stroke=GRAY, width=2.0)
    fig.poly([(xm(tt), ym(np.log10(max(d, 1e-3)))) for tt, d in zip(t, adam)],
             stroke=TEAL, width=2.2)

    for i, (name, color) in enumerate([("gradient descent", GRAY), ("Adam", TEAL)]):
        y = ym(np.log10(0.0055)) + i * 22
        fig.line(L + 12, y - 4, L + 34, y - 4, stroke=color, width=2.2)
        fig.text(L + 40, y, name, size=11.5, fill=INK)

    fig.save(
        "fig2-scales.svg",
        "Two coordinates whose curvatures differ by four orders of magnitude",
        "Distance to the optimum against step number for gradient descent and Adam on "
        "a quadratic whose two coordinates have curvatures 100 and 0.01. Gradient "
        "descent collapses the steep coordinate and leaves the flat one untouched; Adam "
        "moves both at the same rate until it reaches the floor set by its step size.",
    )


# ======================================================================
# figure 3 - bias correction
# ======================================================================

def fig_bias():
    W, H = 720, 360
    fig = Figure(W, H)
    L, R, T, Bm = 72, 614, 42, 286
    xm = mapper(1, 60, L, R)
    ym = mapper(0, 1.08, Bm, T)

    for v in [0, 0.25, 0.5, 0.75, 1.0]:
        fig.line(L, ym(v), R, ym(v), stroke=GRID, width=1)
        fig.text(L - 10, ym(v) + 3.6, f"{v:.2f}", size=10.5, fill=MUTED, anchor="end")
    fig.rect(xm(1), T, xm(11) - xm(1), ym(0) - T, fill=BLUE, opacity=0.045)
    fig.text(xm(1) + 6, T + 14, "first ~1/(1-beta) steps", size=10.5, fill=BLUE,
             opacity=0.9)

    t = np.arange(1, 61)
    for beta, color in [(0.9, RUST), (0.99, SAND)]:
        raw = 1 - beta**t
        fig.poly([(xm(tt), ym(v)) for tt, v in zip(t, raw)], stroke=color, width=2.0)
    fig.line(L, ym(1.0), R, ym(1.0), stroke=BLUE, width=1.8, dash="6 5")
    fig.text(R, ym(1.0) - 9, "after correction", size=11.5, fill=BLUE, anchor="end",
             weight="700")
    fig.text(R, ym(0.93), "m_t / (1 - beta1^t)", size=11, fill=BLUE, anchor="end")

    fig.text(xm(24), ym(0.40), "raw m_t, beta1 = 0.9", size=11.5, fill=RUST, weight="700")
    fig.text(xm(38), ym(0.12), "raw m_t, beta1 = 0.99", size=11.5, fill=SAND,
             weight="700")

    for v in [1, 10, 20, 30, 40, 50, 60]:
        fig.line(xm(v), Bm + 5, xm(v), Bm + 9, stroke=FAINT, width=1)
        fig.text(xm(v), Bm + 21, str(v), size=10.5, fill=MUTED, anchor="middle")
    fig.text((L + R) / 2, Bm + 42, "step", size=11.5, fill=MUTED, anchor="middle")
    fig.text(L - 10, T - 14, "first moment divided by the gradient", size=11.5,
             fill=MUTED)

    fig.save(
        "fig3-bias.svg",
        "Bias of the exponential average in the first steps of Adam",
        "With a constant gradient of one, the raw first-moment estimate rises as "
        "1 - beta^t; dividing by the same factor puts it at one immediately. With a "
        "slower beta the biased stretch lasts hundreds of steps, which is why the "
        "correction matters most at the start of training.",
    )


# ======================================================================
# figure 4 - a sharp and a flat basin
# ======================================================================

def softmin(fl, fs, k=0.045):
    m = np.minimum(fl, fs)
    return m - k * np.log(np.exp(-(fl - m) / k) + np.exp(-(fs - m) / k))


def basin_loss(x, depth=0.06):
    sharp = 0.9 * (x - 1.0) ** 2
    flat = depth + 0.05 * (x + 1.0) ** 2
    return softmin(flat, sharp)


def fig_minima():
    W, H = 720, 400
    fig = Figure(W, H)
    L, R, T, Bm = 72, 372, 58, 300
    xm = mapper(-2.05, 2.05, L, R)
    ym = mapper(0, 0.62, Bm, T)

    xs = np.linspace(-2.05, 2.05, 1400)
    ys = basin_loss(xs)
    keep = ys <= 0.615
    fig.line(L, ym(0), R, ym(0), stroke=FAINT, width=1)
    fig.poly([(xm(x), ym(y)) for x, y in zip(xs[keep], ys[keep])], stroke=BLUE,
             width=2.2)

    left = xs[xs < 0][np.argmin(ys[xs < 0])]
    right = xs[xs > 0][np.argmin(ys[xs > 0])]
    h = 1e-3
    curv = lambda x: (basin_loss(x + h) - 2 * basin_loss(x) + basin_loss(x - h)) / h**2
    Hl, Hr = curv(left), curv(right)

    for x0 in (left, right):
        fig.circle(xm(x0), ym(basin_loss(x0)), 4.2, fill=BLUE)
        fig.line(xm(x0), ym(basin_loss(x0)) + 5, xm(x0), ym(0), stroke=FAINT, width=1,
                 dash="3 4")

    for v in (0.2, 0.4, 0.6):
        fig.line(L, ym(v), R, ym(v), stroke=GRID, width=1)
        fig.text(L - 10, ym(v) + 3.6, f"{v:g}", size=10.5, fill=MUTED, anchor="end")
    fig.text(L - 10, ym(0.0) + 3.6, "0", size=10.5, fill=MUTED, anchor="end")
    fig.text(L, T - 16, "training loss along a slice", size=11.5, fill=MUTED)

    fig.text(xm(left), Bm + 20, "flat basin", size=11.5, fill=INK, anchor="middle",
             weight="700")
    fig.text(xm(left), Bm + 34, f"curvature ~{Hl:.2f}", size=10.5, fill=MUTED,
             anchor="middle")
    fig.text(xm(right), Bm + 20, "sharp basin", size=11.5, fill=INK, anchor="middle",
             weight="700")
    fig.text(xm(right), Bm + 34, f"curvature ~{Hr:.2f}", size=10.5, fill=MUTED,
             anchor="middle")
    fig.rotated(26, (T + Bm) / 2, "loss")

    # ---- right panel: the same two basins under parameter jitter
    L2, R2 = 456, 690
    sigma = 0.35
    z = np.linspace(-4, 4, 4001) * sigma
    w = np.exp(-0.5 * (z / sigma) ** 2)
    w /= w.sum()

    def expected(x0):
        return float(np.sum(w * basin_loss(x0 + z)))

    vals = {"sharp": (basin_loss(right), expected(right)),
            "flat": (basin_loss(left), expected(left))}
    top = max(v[1] for v in vals.values()) * 1.42
    ym2 = mapper(0, top, Bm, T)
    fig.line(L2, ym2(0), R2, ym2(0), stroke=FAINT, width=1)

    centers = {"sharp": L2 + 52, "flat": L2 + 148}
    for name, cx in centers.items():
        train, jitter = vals[name]
        for i, (v, fill, op) in enumerate([(train, LIGHT, 1.0), (jitter, BLUE, 0.85)]):
            x = cx + i * 40 - 34
            height = max(ym2(0) - ym2(v), 2)
            fig.rect(x, ym2(0) - height, 32, height, fill=fill, opacity=op, rx=1.5)
            fig.text(x + 16, ym2(0) - height - 7, f"{abs(v):.3f}", size=10, fill=INK,
                     anchor="middle", weight="700")
        fig.text(cx + 3, Bm + 20, name, size=11, fill=INK, anchor="middle")

    fig.text(L2, T - 16, "loss under weight jitter", size=11.5, fill=MUTED)
    fig.rect(L2, T + 2, 10, 10, fill=LIGHT)
    fig.text(L2 + 15, T + 11, "at the minimum", size=10.5, fill=MUTED)
    fig.rect(L2 + 106, T + 2, 10, 10, fill=BLUE, opacity=0.85)
    fig.text(L2 + 121, T + 11, "expected", size=10.5, fill=MUTED)

    fig.save(
        "fig4-minima.svg",
        "A sharp and a flat basin, with and without weight jitter",
        "Left: a one-dimensional slice through two minima, one narrow and steep, one "
        "wide and shallow. Right: the loss at each minimum and the loss averaged over "
        "Gaussian weight jitter, both computed numerically. The sharp basin wins at the "
        "minimum and loses once the weights move.",
    )


# ======================================================================
# figure 5 - integrals are low-pass filters
# ======================================================================

def fig_lowpass():
    W, H = 720, 390
    fig = Figure(W, H)
    L, R, T, Bm = 88, 620, 46, 300
    w_lo, w_hi = 0.05, 1.0
    xm = mapper(np.log10(w_lo), np.log10(w_hi), L, R)
    ym = mapper(-64, 3, Bm, T)

    for v in [0, -20, -40, -60]:
        fig.line(L, ym(v), R, ym(v), stroke=GRID, width=1)
        fig.text(L - 10, ym(v) + 3.6, str(v), size=10.5, fill=MUTED, anchor="end")

    fig.rect(xm(np.log10(0.45)), T, xm(np.log10(w_hi)) - xm(np.log10(0.45)),
             ym(-64) - T, fill=TEAL, opacity=0.05)
    fig.text(xm(np.log10(0.48)), T + 16, "fast, sharp", size=10.5, fill=TEAL)
    fig.text(xm(np.log10(0.48)), T + 29, "directions", size=10.5, fill=TEAL)

    w = np.logspace(np.log10(0.056), np.log10(w_hi), 420)  # omega / pi
    ref = w_lo
    for k, color in [(1, RUST), (2, BLUE), (3, TEAL)]:
        gain = 20 * k * np.log10(np.sin(np.pi * ref / 2) / np.sin(np.pi * w / 2))
        fig.poly([(xm(np.log10(x)), ym(g)) for x, g in zip(w, gain)],
                 stroke=color, width=2.2)

    fig.text(xm(np.log10(0.072)), ym(-11), "first integral", size=11.5, fill=RUST,
             weight="700")
    fig.text(xm(np.log10(0.17)), ym(-31), "second (DIESGD)", size=11.5, fill=BLUE,
             weight="700")
    fig.text(xm(np.log10(0.34)), ym(-46), "third (MIE)", size=11.5, fill=TEAL,
             weight="700")

    for v, lab in [(0.05, "0.05"), (0.1, "0.1"), (0.3, "0.3"), (1.0, "1")]:
        fig.line(xm(np.log10(v)), Bm + 5, xm(np.log10(v)), Bm + 9, stroke=FAINT,
                 width=1)
        fig.text(xm(np.log10(v)), Bm + 21, lab, size=10.5, fill=MUTED, anchor="middle")
    fig.text((L + R) / 2, Bm + 42,
             "frequency of the gradient signal (omega / pi, log scale)", size=11.5,
             fill=MUTED, anchor="middle")
    fig.rotated(26, (T + Bm) / 2, "gain relative to slow directions (dB)")

    fig.save(
        "fig5-lowpass.svg",
        "Integrating the gradient acts as a low-pass filter",
        "Frequency response of one, two and three cascaded discrete integrations of the "
        "gradient, normalised to unity gain at the lowest frequency shown. Higher orders "
        "suppress the fast components of the gradient, which are the ones that sharpen a "
        "minimum.",
    )


if __name__ == "__main__":
    for old in OUT.glob("*.svg"):
        old.unlink()
    fig_zigzag()
    fig_scales()
    fig_bias()
    fig_minima()
    fig_lowpass()
