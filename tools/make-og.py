"""Render the 1200x630 Open Graph card into static/img/og-cover.jpg.

Run from anywhere:  python tools/make-og.py

Needs Pillow and the Trebuchet MS fonts shipped with Windows (the same face the
site uses). Edit the strings below and re-run; nothing else references this file.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "static" / "img" / "og-cover.jpg"
AVATAR = ROOT / "static" / "img" / "avatar-cat.jpg"

W, H = 1200, 630
MARGIN = 84
TEXT_W = 780

INK = (43, 48, 51)
BODY = (73, 78, 82)
MUTED = (122, 130, 136)
LINK = (34, 75, 141)
RULE = (227, 229, 230)
WHITE = (255, 255, 255)

FONT_DIR = Path(r"C:\Windows\Fonts")
BOLD = str(FONT_DIR / "trebucbd.ttf")
REG = str(FONT_DIR / "trebuc.ttf")

NAME = "Shunbao Zhang"
ROLE = "MSc student · Lanzhou University"
LINE_1 = "Why deep networks generalise and stay robust"
LINE_2 = "Neurodynamics-inspired optimisers for flat minima"
DOMAIN = "vanblue.online"


def main() -> None:
    img = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(img)

    draw.text((MARGIN, 120), NAME, font=ImageFont.truetype(BOLD, 82), fill=INK)
    draw.text((MARGIN, 246), ROLE, font=ImageFont.truetype(REG, 32), fill=MUTED)

    rule_y = 326
    draw.line([(MARGIN, rule_y), (MARGIN + TEXT_W, rule_y)], fill=RULE, width=1)

    stmt_font = ImageFont.truetype(REG, 31)
    draw.text((MARGIN, rule_y + 32), LINE_1, font=stmt_font, fill=BODY)
    draw.text((MARGIN, rule_y + 76), LINE_2, font=stmt_font, fill=BODY)

    draw.text((MARGIN, 524), DOMAIN, font=ImageFont.truetype(REG, 26), fill=LINK)

    # avatar disc with a hairline ring, supersampled so the edge stays smooth
    size, ss, pad = 236, 4, 3
    r = size + pad * 2

    avatar = Image.open(AVATAR).convert("RGB").resize((size, size), Image.LANCZOS)

    mask = Image.new("L", (size * ss, size * ss), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * ss - 1, size * ss - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)

    ring_mask = Image.new("L", (r * ss, r * ss), 0)
    ImageDraw.Draw(ring_mask).ellipse((0, 0, r * ss - 1, r * ss - 1), fill=255)
    ring_mask = ring_mask.resize((r, r), Image.LANCZOS)

    layer = Image.new("RGBA", (r, r), (0, 0, 0, 0))
    layer.paste(Image.new("RGBA", (r, r), RULE + (255,)), (0, 0), ring_mask)
    layer.paste(avatar, (pad, pad), mask)

    ax, ay = W - MARGIN - size, (H - size) // 2
    img.paste(layer, (ax - pad, ay - pad), layer)

    img.save(OUT, "JPEG", quality=90, optimize=True, progressive=True)
    print(f"wrote {OUT} ({W}x{H}, {OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
