"""
One-off asset pipeline: pull the Kingdom art out of the Kingmaker Player's Guide.

Produces two things under public/kingdom/:
  map/sheet-<n>.jpg           the four blank Stolen Lands map sheets (pages 78-81)
  map/manifest.json           per-sheet size + solved hex-grid geometry
  structures/<slug>.png       one top-down tile per structure (pages 84-85)
  structures/manifest.json    slug -> {file, width, height, lots}

The guide calls these "blank maps of the Stolen Lands" (plural) and each sheet
carries its own compass rose, so they are kept as four separate sheets. Attempts
to assemble them into one map produced strong-looking correlations that turned
out to be the repeating hex lattice matching itself, not terrain continuity --
do not re-stitch them without independent evidence.

The hex grid geometry is measured, not assumed: a high-pass ridge mask of the
grid lines autocorrelates at 175px horizontally and 152px vertically. Their
ratio is 1.151 against the 1.1547 a pointy-top lattice predicts, which fixes the
orientation and gives a circumradius of ~101px.

Run:  python scripts/extract-kingdom-assets.py
Needs: pymupdf, pillow  (dev-only; not part of the app runtime)
"""

import io
import json
import math
import re
from pathlib import Path

import pymupdf
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "docs" / "Kingmaker+Players+Guide.pdf"
OUT = ROOT / "public" / "kingdom"

# The four hex-map sheets, in page order.
MAP_SHEETS = [77, 78, 79, 80]

# Pointy-top lattice, in source pixels. See the module docstring.
HEX_COL_PITCH = 175
HEX_ROW_PITCH = 152

STRUCTURE_PAGES = [83, 84]

# Section headings on the structure sheets, in the order they appear.
LOT_HEADINGS = {
    "One-Lot Buildings": 1,
    "Two-Lot Buildings": 2,
    "Four-Lot Buildings": 4,
}


def slugify(label: str) -> str:
    s = label.lower().replace("'", "").replace("’", "")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def page_image(doc, page_no: int) -> Image.Image:
    """The single full-bleed image on a map sheet."""
    xref = doc[page_no].get_images(full=True)[0][0]
    return Image.open(io.BytesIO(doc.extract_image(xref)["image"])).convert("RGB")


def hex_outline(circumradius: float, samples_per_edge: int = 12):
    """Points tracing one pointy-top hexagon, relative to its centre."""
    import numpy as np

    corners = [
        (
            circumradius * math.sin(math.pi / 3 * i),
            -circumradius * math.cos(math.pi / 3 * i),
        )
        for i in range(6)
    ]
    points = []
    for i in range(6):
        x0, y0 = corners[i]
        x1, y1 = corners[(i + 1) % 6]
        for t in np.linspace(0, 1, samples_per_edge, endpoint=False):
            points.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    return np.array(points)


def grid_origin(gray: Image.Image) -> tuple[int, int]:
    """
    Phase of the hex lattice within a sheet: the centre of hex (0, 0).

    Fitting the whole hexagon outline is what disambiguates this. A hex lattice
    has vertical edges every *half* column pitch, so a one-dimensional comb of
    grid lines scores two phases equally well and picks between them by noise --
    which is what an earlier version of this did, and it produced origins that
    disagreed wildly between otherwise identical sheets. The slanted edges only
    line up for the true phase, so scoring against the full outline resolves it.
    """
    import numpy as np

    a = np.asarray(gray).astype(float)
    blurred = np.asarray(gray.filter(ImageFilter.GaussianBlur(12))).astype(float)
    ridges = (a - blurred > 10).astype(float)
    height, width = ridges.shape

    outline = hex_outline(HEX_ROW_PITCH / 1.5)  # circumradius R; rowPitch = 1.5R
    centres = np.array(
        [
            (col * HEX_COL_PITCH + (row % 2) * HEX_COL_PITCH / 2, row * HEX_ROW_PITCH)
            for row in range(-1, int(height / HEX_ROW_PITCH) + 2)
            for col in range(-1, int(width / HEX_COL_PITCH) + 2)
        ]
    )

    def score(ox: float, oy: float) -> float:
        pts = (centres[:, None, :] + outline[None, :, :]).reshape(-1, 2)
        xs = np.rint(pts[:, 0] + ox).astype(int)
        ys = np.rint(pts[:, 1] + oy).astype(int)
        inside = (xs >= 0) & (xs < width) & (ys >= 0) & (ys < height)
        if not inside.any():
            return 0.0
        return float(ridges[ys[inside], xs[inside]].mean())

    def best(coarse_x, coarse_y):
        return max(
            ((score(ox, oy), ox, oy) for oy in coarse_y for ox in coarse_x),
            key=lambda t: t[0],
        )
    _, ox, oy = best(range(0, HEX_COL_PITCH, 4), range(0, HEX_ROW_PITCH, 4))
    _, ox, oy = best(range(ox - 4, ox + 5), range(oy - 4, oy + 5))
    return int(ox % HEX_COL_PITCH), int(oy % HEX_ROW_PITCH)


def extract_map(doc) -> None:
    dest = OUT / "map"
    dest.mkdir(parents=True, exist_ok=True)
    manifest = {}

    for n, page_no in enumerate(MAP_SHEETS, start=1):
        im = page_image(doc, page_no)
        name = f"sheet-{n}.jpg"
        im.save(dest / name, quality=88, optimize=True)
        ox, oy = grid_origin(im.convert("L"))
        manifest[f"sheet-{n}"] = {
            "file": f"/kingdom/map/{name}",
            "width": im.width,
            "height": im.height,
            "hex": {
                "orientation": "pointy",
                "colPitch": HEX_COL_PITCH,
                "rowPitch": HEX_ROW_PITCH,
                "originX": ox,
                "originY": oy,
                "cols": round(im.width / HEX_COL_PITCH),
                "rows": round(im.height / HEX_ROW_PITCH),
            },
        }
        print(f"  {name}: {im.width}x{im.height} grid origin ({ox}, {oy})")

    (dest / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True))
    write_sheet_module(manifest)
    print(f"map: {len(manifest)} sheets -> {dest}")


def write_sheet_module(manifest: dict) -> None:
    """Emit the manifest as a typed TS constant so the app cannot drift from it."""
    lines = [
        "/**",
        " * The Stolen Lands map sheets and their measured hex geometry.",
        " *",
        " * GENERATED by scripts/extract-kingdom-assets.py. The same data is served as",
        " * public/kingdom/map/manifest.json; this module exists so the client gets it",
        " * typed and bundled instead of fetching it. Re-run the script rather than",
        " * editing the numbers by hand.",
        " */",
        "",
        'import type { HexGeometry } from "./hex";',
        "",
        "export interface MapSheet {",
        "  /** 1-based sheet number, matching Hex.sheet in the database. */",
        "  id: number;",
        "  name: string;",
        "  file: string;",
        "  width: number;",
        "  height: number;",
        "  hex: HexGeometry;",
        "}",
        "",
        "export const MAP_SHEETS: MapSheet[] = [",
    ]
    for key in sorted(manifest):
        entry = manifest[key]
        hex_ = entry["hex"]
        number = int(key.split("-")[1])
        lines += [
            "  {",
            f"    id: {number},",
            f'    name: "Sheet {number}",',
            f'    file: "{entry["file"]}",',
            f"    width: {entry['width']},",
            f"    height: {entry['height']},",
            "    hex: {",
            f"      colPitch: {hex_['colPitch']},",
            f"      rowPitch: {hex_['rowPitch']},",
            f"      originX: {hex_['originX']},",
            f"      originY: {hex_['originY']},",
            f"      cols: {hex_['cols']},",
            f"      rows: {hex_['rows']},",
            "    },",
            "  },",
        ]
    lines += [
        "];",
        "",
        "export function getMapSheet(id: number): MapSheet | undefined {",
        "  return MAP_SHEETS.find((s) => s.id === id);",
        "}",
        "",
    ]
    target = ROOT / "src" / "lib" / "map-sheets.ts"
    target.write_text("\n".join(lines), encoding="utf-8")
    print(f"  sheet module -> {target}")


def text_lines(page):
    """Every text line on the page as (text, bbox), reading order irrelevant."""
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if text:
                out.append((text, pymupdf.Rect(line["bbox"])))
    return out


def extract_structures(doc) -> None:
    dest = OUT / "structures"
    dest.mkdir(parents=True, exist_ok=True)
    manifest = {}

    for page_no in STRUCTURE_PAGES:
        page = doc[page_no]
        lines = text_lines(page)
        headings = sorted(
            ((r.y0, LOT_HEADINGS[t]) for t, r in lines if t in LOT_HEADINGS),
            key=lambda pair: pair[0],
        )
        # Labels are everything that isn't a heading or the copyright line.
        labels = [
            (t, r)
            for t, r in lines
            if t not in LOT_HEADINGS and "Paizo" not in t and len(t) > 2
        ]

        seen = set()
        for xref, *_ in page.get_images(full=True):
            if xref in seen:
                continue
            seen.add(xref)
            for rect in page.get_image_rects(xref):
                # The tile's label sits directly beneath it, roughly centred.
                cx = (rect.x0 + rect.x1) / 2
                below = [
                    (r.y0 - rect.y1, t)
                    for t, r in labels
                    if r.y0 >= rect.y1 - 2 and r.x0 - 20 <= cx <= r.x1 + 20
                ]
                if not below:
                    continue
                gap, label = min(below)
                if gap > 30:  # too far to be this tile's caption
                    continue

                lots = 1
                for y, n in headings:
                    if rect.y0 >= y:
                        lots = n

                slug = slugify(label)
                data = doc.extract_image(xref)
                im = Image.open(io.BytesIO(data["image"])).convert("RGBA")
                im.save(dest / f"{slug}.png")
                manifest[slug] = {
                    "name": label,
                    "file": f"/kingdom/structures/{slug}.png",
                    "width": im.width,
                    "height": im.height,
                    "lots": lots,
                }

    (dest / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True))
    print(f"structures: {len(manifest)} tiles -> {dest}")


def main() -> None:
    doc = pymupdf.open(PDF)
    extract_map(doc)
    extract_structures(doc)


if __name__ == "__main__":
    main()
