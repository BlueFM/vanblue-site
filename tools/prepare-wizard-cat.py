#!/usr/bin/env python3
"""Prepare the website guardian artwork using only Python and Pillow.

Example (run from the repository root; keep the external originals out of Git):
    python tools/prepare-wizard-cat.py --source-zip /path/to/wizard-cat-pet-animation.zip \
        --cast-image ../.tmp/wizard-cat-cast-source.png

The cast recipe is tuned to the supplied square, beige-background cat-and-book
reference (1254 x 1254, or a resolution-scaled copy), not arbitrary photographs.
Copy a Harness attachment to a workspace .png before supplying --cast-image.
Its missing near ear is restored from the ZIP's transparent idle-open original.
Without that optional reference, cell 10 deliberately reuses idle-open.

Contract: static RGBA WebP, 4 columns x 3 rows, 384 px cells; index 11 is empty.
All frames in an action share one union crop, one scale and one translation.
Diagnostics and provenance go outside the repository, in ../.tmp by default.
Reproducible encoded bytes require the same Pillow/libwebp versions.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps, __version__, features

CELL = 384
COLUMNS, ROWS = 4, 3
BASELINE = 366  # Exclusive lower bound; 18 transparent pixels below every action.
MAX_WIDTH, MAX_HEIGHT = 344, 348
ALPHA_NOISE_FLOOR = 3  # <= 1.18% opacity; do not threshold visible contours.
OPAQUE_SNAP = 248
GROUPS = (
    ("idle-blink", ("open", "half", "closed")),
    ("sleep-breath", ("rest", "inhale", "peak")),
    ("walk-right", ("lift", "contact", "swing", "passing")),
)
LABELS = (
    "idle open", "idle half", "idle closed", "sleep rest", "sleep inhale",
    "sleep peak", "walk lift", "walk contact", "walk swing", "walk passing",
    "cast", "empty",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def hidden_rgb_count(image: Image.Image) -> int:
    red, green, blue, alpha = image.split()
    nonzero = ImageChops.lighter(ImageChops.lighter(red, green), blue).point(
        lambda value: 255 if value else 0
    )
    invisible = alpha.point(lambda value: 255 if value == 0 else 0)
    return ImageChops.multiply(nonzero, invisible).histogram()[255]


def clear_invisible_rgb(image: Image.Image) -> Image.Image:
    image = image.copy()
    invisible = image.getchannel("A").point(lambda value: 255 if value == 0 else 0)
    image.paste((0, 0, 0, 0), (0, 0), invisible)
    return image


def clean_source(image: Image.Image) -> tuple[Image.Image, dict]:
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    stats = {
        "original_alpha_bbox": alpha.getbbox(),
        "hidden_rgb_pixels_before": hidden_rgb_count(image),
        "removed_alpha_1_to_3_pixels": sum(alpha.histogram()[1:4]),
    }
    alpha = alpha.point(lambda value: 0 if value <= ALPHA_NOISE_FLOOR else (
        255 if value >= OPAQUE_SNAP else value
    ))
    image.putalpha(alpha)
    image = clear_invisible_rgb(image)
    stats.update(clean_alpha_bbox=alpha.getbbox(), hidden_rgb_pixels_after=hidden_rgb_count(image))
    return image, stats


def read_animation_zip(path: Path) -> tuple[dict[str, list[Image.Image]], dict]:
    groups, cleanup = {}, {}
    with ZipFile(path) as archive:
        manifests = [name for name in archive.namelist()
                     if PurePosixPath(name).name == "animation.json"
                     and "__MACOSX" not in PurePosixPath(name).parts]
        if len(manifests) != 1:
            raise ValueError("Expected exactly one animation.json in the source ZIP")
        manifest_name = manifests[0]
        prefix = manifest_name[:-len("animation.json")]
        manifest = json.loads(archive.read(manifest_name))
        loops = {loop["id"]: loop for loop in manifest["loops"]}
        for action, expected_names in GROUPS:
            loop = loops[action]
            ordered = list(dict.fromkeys(item["frame"] for item in loop["sequence"]))
            if tuple(PurePosixPath(name).stem for name in ordered) != expected_names:
                raise ValueError(f"Unexpected frame order for {action}: {ordered}")
            frames = []
            for name in ordered:
                if PurePosixPath(name).is_absolute() or ".." in PurePosixPath(name).parts:
                    raise ValueError(f"Unsafe manifest frame path: {name}")
                with Image.open(io.BytesIO(archive.read(prefix + name))) as source:
                    if source.size != tuple(loop["canvas"]):
                        raise ValueError(f"Canvas differs from animation.json: {name}")
                    if "A" not in source.getbands():
                        raise ValueError(f"Expected a transparent PNG: {name}")
                    frame, cleanup[name] = clean_source(source)
                    frames.append(frame)
            groups[action] = frames
    return groups, cleanup


def fill_cat_silhouette(barrier: Image.Image, seed: tuple[int, int]) -> Image.Image:
    # Flood only edge-connected background; enclosed book pages, eyes and moon stay.
    width, height = barrier.size
    flooded = ImageOps.expand(barrier, border=1, fill=0)
    ImageDraw.floodfill(flooded, (0, 0), 128, thresh=0)
    solid = flooded.crop((1, 1, width + 1, height + 1)).point(
        lambda value: 0 if value == 128 else 255
    )
    if solid.getpixel(seed) != 255:
        raise ValueError("Cast reference does not match the expected cat-and-book composition")
    # A second flood keeps just the connected cat + book, not fish or ground debris.
    ImageDraw.floodfill(solid, seed, 128, thresh=0)
    return solid.point(lambda value: 255 if value == 128 else 0)


def remove_cheek_glow(rgb: Image.Image, alpha: Image.Image, scale: float) -> tuple[Image.Image, int]:
    # Harmonic diffusion across the thin green beam. Protect the pink tongue and
    # preserve the original mouth, fangs, whiskers and silhouette. No AI dependency.
    def bounds(box):
        return tuple(round(value * scale) for value in box)

    pixels, opacity = rgb.load(), alpha.load()
    mask = Image.new("L", rgb.size)
    target = mask.load()
    left, top, right, bottom = bounds((700, 588, 881, 638))
    for y in range(top, bottom):
        for x in range(left, right):
            red, green, blue = pixels[x, y]
            if opacity[x, y] and green > (red + blue) / 2 + 4 and green > 80:
                target[x, y] = 255
    kernel = max(3, round(11 * scale) | 1)
    mask = mask.filter(ImageFilter.MaxFilter(kernel))
    target = mask.load()
    left, top, right, bottom = bounds((690, 578, 893, 648))
    coordinates = []
    for y in range(top, bottom):
        for x in range(left, right):
            red, green, blue = pixels[x, y]
            tongue = red > 145 and green < red * 0.76 and blue < red * 0.8
            if target[x, y] and opacity[x, y] and not tongue:
                coordinates.append((x, y))
    lookup = {xy: index for index, xy in enumerate(coordinates)}
    values = [[102.0, 75.0, 65.0] for _ in coordinates]
    neighbors = []
    for x, y in coordinates:
        references, fixed, count = [], [0.0, 0.0, 0.0], 0
        for neighbor in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if opacity[neighbor] < 128:
                continue
            count += 1
            index = lookup.get(neighbor)
            if index is not None:
                references.append(index)
            else:
                for channel, value in enumerate(pixels[neighbor]):
                    fixed[channel] += value
        neighbors.append((references, fixed, max(count, 1)))
    for _ in range(500):
        for index, (references, fixed, count) in enumerate(neighbors):
            total = fixed.copy()
            for neighbor in references:
                for channel in range(3):
                    total[channel] += values[neighbor][channel]
            values[index] = [value / count for value in total]
    result = rgb.copy()
    target = result.load()
    for xy, color in zip(coordinates, values):
        target[xy] = tuple(round(value) for value in color)
    return result, len(coordinates)


def restore_cast_ear(cast: Image.Image, idle_open: Image.Image) -> tuple[Image.Image, dict]:
    # Reuse the near ear's actual fur, pink interior and dark contour from the
    # transparent idle original. The traced boundary excludes its purple hat.
    outline = ((387, 424), (390, 385), (395, 353), (401, 326),
               (409, 302), (418, 281), (428, 265), (438, 257),
               (448, 254), (459, 255), (475, 259), (494, 267),
               (514, 278), (534, 291), (552, 305), (569, 321),
               (583, 339), (581, 343), (556, 356), (531, 369),
               (505, 381), (478, 393), (450, 405), (420, 417),
               (398, 425), (389, 427))
    sx, sy = idle_open.width / 1234, idle_open.height / 1275
    mask = Image.new("L", (idle_open.width * 3, idle_open.height * 3))
    ImageDraw.Draw(mask).polygon(
        [(round(x * sx * 3), round(y * sy * 3)) for x, y in outline], fill=255)
    mask = mask.resize(idle_open.size, Image.Resampling.LANCZOS)
    mask = ImageChops.multiply(mask, idle_open.getchannel("A"))
    red, green, blue, _ = idle_open.split()
    ear = Image.merge("RGBA", (red, green.point(lambda value: round(value * 0.95)),
                              blue.point(lambda value: round(value * 0.82)), mask))

    # Match the cast hat's perspective with a mild shear/scale, and its warmer
    # lighting with the channel tint above. Source root-left/root-right/tip:
    # (389,426), (586,342), (445,255); target: (329,453), (535,368), (391,284).
    ux, uy, vx, vy = 206, -85, 62, -169
    determinant = ux * vy - vx * uy
    a = (197 * vy - 56 * uy) / determinant
    b = (ux * 56 - vx * 197) / determinant
    d = (-84 * vy + 171 * uy) / determinant
    e = (-171 * ux + 84 * vx) / determinant
    c, f = 389 - a * 329 - b * 453, 426 - d * 329 - e * 453
    scale = cast.width / 1254
    inverse = (a * sx / scale, b * sx / scale, c * sx,
               d * sy / scale, e * sy / scale, f * sy)
    ear = ear.convert("RGBa").transform(cast.size, Image.Transform.AFFINE, inverse,
                                      Image.Resampling.BICUBIC).convert("RGBA")

    # Keep the original front brim IN FRONT of the root: the ear emerges through
    # an opening, not on top of the brim. Do not touch the existing far ear.
    brim_edge = ((310, 471), (335, 454), (360, 438), (390, 421),
                 (420, 406), (450, 393), (480, 382), (510, 371),
                 (540, 361), (570, 350), (600, 340))
    foreground = Image.new("L", (cast.width * 3, cast.height * 3))
    ImageDraw.Draw(foreground).polygon(
        [(round(x * scale * 3), round(y * scale * 3)) for x, y in brim_edge]
        + [(round(600 * scale * 3), cast.height * 3),
           (round(310 * scale * 3), cast.height * 3)], fill=255)
    foreground = foreground.resize(cast.size, Image.Resampling.LANCZOS)
    ear.putalpha(ImageChops.multiply(ear.getchannel("A"), ImageChops.invert(foreground)))
    result = clear_invisible_rgb(Image.alpha_composite(cast, ear))
    assert result.getchannel("A").getbbox() == cast.getchannel("A").getbbox(), "Ear repair must not change placement"
    return result, {"source_frame": "frames/idle-blink/open.png", "source_ear": "near/left",
                    "tint_rgb": [1, 0.95, 0.82], "front_brim_occludes_root": True,
                    "tip_in_reference_xy": [391, 284],
                    "root_in_reference_xy": [[329, 453], [535, 368]],
                    "composite_bbox_xyxy_exclusive": ear.getchannel("A").getbbox()}


def prepare_cast(path: Path, idle_open: Image.Image) -> tuple[Image.Image, dict]:
    with Image.open(path) as source:
        rgb = ImageOps.exif_transpose(source).convert("RGB")
    width, height = rgb.size
    if width != height or width < CELL:
        raise ValueError("The optional cast reference must be the supplied square artwork")
    scale = width / 1254

    def box(values):
        return tuple(round(value * scale) for value in values)

    def close(image, reference_kernel):
        kernel = max(3, round(reference_kernel * scale) | 1)
        return image.filter(ImageFilter.MaxFilter(kernel)).filter(ImageFilter.MinFilter(kernel))

    # Beige background, brown ground shadow and pale green effects are all light.
    # Dark outlines are barriers; flood filling, not global color-keying, preserves
    # similarly light book pages and eye highlights enclosed by those outlines.
    raw = rgb.tobytes()
    barrier = Image.frombytes("L", rgb.size, bytes(
        0 if red >= 140 and green >= 100 and blue >= 75 else 255
        for red, green, blue in zip(raw[0::3], raw[1::3], raw[2::3])
    ))
    closed = close(barrier, 5)
    # The green beam crosses the cheek outline. Bridge that narrow gap locally
    # before flooding; a global large closing would round off the curled tail.
    patch = close(barrier.crop(box((650, 530, 960, 690))), 31)
    closed.paste(patch.crop(box((30, 30, 280, 130))), box((680, 560)))
    alpha = fill_cat_silhouette(closed, box((600, 800)))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.45 * scale))
    rgb, repaired = remove_cheek_glow(rgb, alpha, scale)
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    result, cleanup = clean_source(result)
    result, ear_repair = restore_cast_ear(result, idle_open)
    return result, {"sha256": sha256(path), "original_size": [width, height],
                    "repaired_cheek_pixels": repaired, "cleanup": cleanup,
                    "ear_repair": ear_repair}


def place_action(frames: list[Image.Image]) -> tuple[list[Image.Image], dict]:
    boxes = [frame.getchannel("A").getbbox() for frame in frames]
    if not all(boxes):
        raise ValueError("An action contains an empty frame")
    # One padded union for the WHOLE action: never auto-trim individual frames.
    left = max(0, min(box[0] for box in boxes) - 2)
    top = max(0, min(box[1] for box in boxes) - 2)
    right = min(frames[0].width, max(box[2] for box in boxes) + 2)
    bottom = min(frames[0].height, max(box[3] for box in boxes) + 2)
    crop = (left, top, right, bottom)
    scale = min(MAX_WIDTH / (right - left), MAX_HEIGHT / (bottom - top))
    size = (round((right - left) * scale), round((bottom - top) * scale))
    offset = ((CELL - size[0]) // 2, BASELINE - size[1])
    tiles = []
    for frame in frames:
        # Premultiplied-alpha Lanczos prevents color bleeding into transparent edges.
        artwork = frame.crop(crop).convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")
        tile = Image.new("RGBA", (CELL, CELL))
        tile.alpha_composite(artwork, offset)
        tiles.append(clear_invisible_rgb(tile))
    return tiles, {"crop_xyxy_exclusive": crop, "resized_size": size, "offset_xy": offset,
                   "scale_xy": [size[0] / (right - left), size[1] / (bottom - top)],
                   "baseline_exclusive": BASELINE}


def write_contact_sheets(atlas: Image.Image, directory: Path) -> None:
    for theme in ("checker", "white", "dark"):
        sheet = Image.new("RGB", (CELL * COLUMNS, (CELL + 28) * ROWS), "#ffffff")
        for index, label in enumerate(LABELS):
            background = Image.new("RGBA", (CELL, CELL), "#171c2d" if theme == "dark" else "#ffffff")
            draw = ImageDraw.Draw(background)
            if theme == "checker":
                for y in range(0, CELL, 16):
                    for x in range(0, CELL, 16):
                        if (x // 16 + y // 16) % 2:
                            draw.rectangle((x, y, x + 15, y + 15), fill="#e5e8ef")
            draw.line((0, BASELINE, CELL, BASELINE), fill="#506076" if theme == "dark" else "#bac3d0")
            x, y = (index % COLUMNS) * CELL, (index // COLUMNS) * CELL
            background.alpha_composite(atlas.crop((x, y, x + CELL, y + CELL)))
            dy = (index // COLUMNS) * (CELL + 28)
            sheet.paste(background.convert("RGB"), (x, dy))
            draw = ImageDraw.Draw(sheet)
            draw.rectangle((x, dy, x + CELL - 1, dy + CELL - 1), outline="#8b95a6")
            draw.text((x + 10, dy + CELL + 8), f"{index:02d}  {label}", fill="#27374f")
        sheet.save(directory / f"contact-sheet-{theme}.png", optimize=True)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source-zip", type=Path, required=True, help="External animation ZIP (never copied into the repository)")
    parser.add_argument("--cast-image", type=Path, help="Workspace PNG copy of the optional beige-background cast reference")
    parser.add_argument("--output-dir", type=Path, default=root / "static/img/wizard-cat")
    parser.add_argument("--diagnostics-dir", type=Path, default=root.parent / ".tmp/wizard-cat-preview")
    parser.add_argument("--quality", type=int, choices=range(82, 89), default=85, metavar="82..88")
    args = parser.parse_args()
    if not features.check("webp"):
        raise RuntimeError("This Pillow build does not support WebP")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.diagnostics_dir.mkdir(parents=True, exist_ok=True)
    groups, cleanup = read_animation_zip(args.source_zip)
    tiles, placement = [], {}
    for action, _ in GROUPS:
        prepared, placement[action] = place_action(groups[action])
        tiles.extend(prepared)
    cast_report = {"fallback_to_idle": True}
    if args.cast_image:
        cast, cast_report = prepare_cast(args.cast_image, groups["idle-blink"][0])
        prepared, placement["cast"] = place_action([cast])
        tiles.extend(prepared)
        cast.save(args.diagnostics_dir / "cast-cutout.png", optimize=True)
        # The mouth is at approximately (706, 610) in the original reference.
        crop = placement["cast"]["crop_xyxy_exclusive"]
        sx, sy = placement["cast"]["scale_xy"]
        ox, oy = placement["cast"]["offset_xy"]
        mouth = [round(ox + (706 * cast.width / 1254 - crop[0]) * sx, 1),
                 round(oy + (610 * cast.height / 1254 - crop[1]) * sy, 1)]
        cast_report.update(fallback_to_idle=False, mouth_in_cell_xy=mouth,
                           mouth_in_mirrored_cell_xy=[round(CELL - mouth[0], 1), mouth[1]])
    else:
        print("WARNING: no cast reference supplied; cell 10 reuses idle-open", file=sys.stderr)
        tiles.append(tiles[0].copy())
    tiles.append(Image.new("RGBA", (CELL, CELL)))
    atlas = Image.new("RGBA", (CELL * COLUMNS, CELL * ROWS))
    for index, tile in enumerate(tiles):
        atlas.paste(tile, ((index % COLUMNS) * CELL, (index // COLUMNS) * CELL))
    options = {"format": "WEBP", "lossless": False, "quality": args.quality,
               "method": 6, "alpha_quality": 100, "exact": True}
    atlas.save(args.output_dir / "sprites.webp", **options)
    tiles[0].save(args.output_dir / "idle.webp", **options)
    with Image.open(args.output_dir / "sprites.webp") as encoded:
        assert encoded.size == (1536, 1152) and not getattr(encoded, "is_animated", False)
        decoded = encoded.convert("RGBA")
    assert ImageChops.difference(decoded.getchannel("A"), atlas.getchannel("A")).getbbox() is None, "Alpha must remain lossless"
    assert decoded.crop((3 * CELL, 2 * CELL, 4 * CELL, 3 * CELL)).getchannel("A").getbbox() is None
    write_contact_sheets(decoded, args.diagnostics_dir)
    outputs = {}
    for name in ("sprites.webp", "idle.webp"):
        path = args.output_dir / name
        with Image.open(path) as image:
            outputs[name] = {"size": list(image.size), "bytes": path.stat().st_size,
                             "sha256": sha256(path), "animated": getattr(image, "is_animated", False)}
    total = sum(item["bytes"] for item in outputs.values())
    if total >= 500_000:
        raise RuntimeError(f"Resource budget exceeded: {total} bytes; lower --quality")
    report = {"pillow": __version__, "libwebp": features.version("webp"),
              "source_zip_sha256": sha256(args.source_zip), "quality": args.quality,
              "grid": [COLUMNS, ROWS], "cell": [CELL, CELL], "indices": dict(enumerate(LABELS)),
              "placement": placement, "source_cleanup": cleanup, "cast": cast_report,
              "outputs": outputs, "total_bytes": total,
              "encoded_alpha_matches_preencode": True,
              "tile_alpha_bboxes": [decoded.crop(((i % 4) * CELL, (i // 4) * CELL,
                  (i % 4 + 1) * CELL, (i // 4 + 1) * CELL)).getchannel("A").getbbox() for i in range(12)]}
    (args.diagnostics_dir / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"outputs": outputs, "total_bytes": total, "cast": cast_report,
                      "placement": placement, "diagnostics": str(args.diagnostics_dir)}, indent=2))


if __name__ == "__main__":
    main()
