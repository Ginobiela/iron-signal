"""Deterministic extraction of the supplied irregular sheet; no generated artwork."""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art-reference/player/source.png"
OUTPUT = ROOT / "public/assets/sprites/player"
CELL = 32
SOURCE_PIXELS_PER_PIXEL = 14
ALPHA_THRESHOLD = 128
RASTER_PHASE_Y = {"idle": [-3, -3, -3, -3], "run": [3, 3, 4, 3, 3, 5], "crouch": [0, 0]}


def regions(alpha):
    pending = alpha >= ALPHA_THRESHOLD
    labels = np.zeros(alpha.shape, dtype=np.uint16)
    height, width = pending.shape
    found = []
    label = 0
    for y, x in zip(*np.where(pending)):
        if not pending[y, x]:
            continue
        label += 1
        pending[y, x] = False
        stack = [(int(x), int(y))]
        area = 0
        left = right = int(x)
        top = bottom = int(y)
        while stack:
            cx, cy = stack.pop()
            labels[cy, cx] = label
            area += 1
            left, right = min(left, cx), max(right, cx)
            top, bottom = min(top, cy), max(bottom, cy)
            for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                if 0 <= nx < width and 0 <= ny < height and pending[ny, nx]:
                    pending[ny, nx] = False
                    stack.append((nx, ny))
        if area > 1000:
            found.append({"label": label, "bbox": [left, top, right + 1, bottom + 1], "area": area})
    return labels, found


def main():
    source_bytes = SOURCE.read_bytes()
    source = Image.open(SOURCE)
    rgba = np.array(source.convert("RGBA"))
    labels, found = regions(rgba[:, :, 3])
    assert len(found) == 12, f"Expected 12 poses, found {len(found)}"
    # Rows are detected from occupied regions, rather than dividing the source into cells.
    ordered = sorted(found, key=lambda region: region["bbox"][1])
    rows = []
    for region in ordered:
        if not rows or region["bbox"][1] > rows[-1][0]["bbox"][1] + 100:
            rows.append([])
        rows[-1].append(region)
    assert [len(row) for row in rows] == [4, 6, 2]
    report = {"sourceSize": list(source.size), "sourceMode": source.mode,
              "sourceSHA256": hashlib.sha256(source_bytes).hexdigest(),
              "alpha": {"zero": int((rgba[:, :, 3] == 0).sum()),
                        "semi": int(((rgba[:, :, 3] > 0) & (rgba[:, :, 3] < 255)).sum()),
                        "opaque": int((rgba[:, :, 3] == 255).sum()), "max": int(rgba[:, :, 3].max())},
              "alphaThreshold": ALPHA_THRESHOLD, "cell": [CELL, CELL],
              "scale": 1 / SOURCE_PIXELS_PER_PIXEL, "origin": [CELL / 2, CELL],
              "rasterPhaseY": RASTER_PHASE_Y, "animations": {}}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, row, visor_offset in zip(("idle", "run", "crouch"), rows, (36, 54, 50)):
        row.sort(key=lambda region: region["bbox"][0])
        sheet = Image.new("RGBA", (CELL * len(row), CELL))
        frames = []
        for index, region in enumerate(row):
            left, top, right, bottom = region["bbox"]
            crop = rgba[top:bottom, left:right].copy()
            own = labels[top:bottom, left:right] == region["label"]
            # Each component gets its own mask: overlapping bounding boxes contain other poses.
            crop[:, :, 3] = np.where(own, 255, 0)
            crop[~own, :3] = 0
            visor = own & (crop[:, :, 0] < 100) & (crop[:, :, 1] > 150) & (crop[:, :, 2] > 110)
            visor[100:, :] = False
            _, visor_x = np.where(visor)
            assert len(visor_x) > 0
            # Anatomical torso axis calibrated against the stable visor landmark, not bbox center.
            origin_x = float(np.median(visor_x) + left - visor_offset)
            scale = SOURCE_PIXELS_PER_PIXEL
            frame = Image.fromarray(crop).transform((CELL, CELL), Image.Transform.AFFINE,
                (scale, 0, origin_x - left - CELL / 2 * scale,
                 0, scale, bottom - top + RASTER_PHASE_Y[name][index] - CELL * scale), resample=Image.Resampling.NEAREST)
            bounds = frame.getbbox()
            assert bounds and bounds[3] == CELL, f"Floating feet: {name}/{index}"
            assert 0 < bounds[0] and bounds[2] < CELL and bounds[1] > 0, f"Clipped pose: {name}/{index}"
            assert set(np.unique(np.array(frame)[:, :, 3])) <= {0, 255}
            sheet.paste(frame, (index * CELL, 0))
            frames.append({"bbox": region["bbox"], "area": region["area"],
                           "originX": origin_x, "baselineY": bottom, "normalizedBBox": list(bounds)})
        sheet.save(OUTPUT / f"player_{name}.png")
        report["animations"][name] = {"sheetSize": list(sheet.size), "frames": frames}
    assert SOURCE.read_bytes() == source_bytes
    (ROOT / "art-reference/player/normalization.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
