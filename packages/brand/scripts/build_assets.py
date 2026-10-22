"""Crop the approved Raft drawings into shared assets.

The sheet background is the same cream as the otter belly, so the
background is removed by a flood fill from the edges. Interior cream stays.
"""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "source"
OUT = ROOT / "assets"
DOCS = ROOT.parents[1] / "docs" / "images"
FONT = ROOT.parents[1] / "apps" / "site" / "assets" / "fonts" / "Inter-600.ttf"

CREAM = (250, 246, 238, 255)
CHOCOLATE = (107, 74, 51, 255)


def knock_out(image: Image.Image, tolerance: int = 42) -> Image.Image:
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    background = pixels[0, 0][:3]
    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def consider(x: int, y: int) -> None:
        index = y * width + x
        if seen[index]:
            return
        red, green, blue, _alpha = pixels[x, y]
        distance = abs(red - background[0]) + abs(green - background[1]) + abs(blue - background[2])
        if distance <= tolerance:
            seen[index] = 1
            queue.append((x, y))
        else:
            seen[index] = 2

    for x in range(width):
        consider(x, 0)
        consider(x, height - 1)
    for y in range(height):
        consider(0, y)
        consider(width - 1, y)

    while queue:
        x, y = queue.popleft()
        red, green, blue, _alpha = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < width and 0 <= ny < height:
                consider(nx, ny)

    # Drop a one-pixel cream fringe that JPEG left on the outline.
    for _pass in range(2):
        fringe: list[tuple[int, int]] = []
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                red, green, blue, alpha = pixels[x, y]
                if alpha == 0:
                    continue
                distance = abs(red - background[0]) + abs(green - background[1]) + abs(blue - background[2])
                if distance > tolerance + 18:
                    continue
                if any(pixels[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    fringe.append((x, y))
        for x, y in fringe:
            red, green, blue, _alpha = pixels[x, y]
            pixels[x, y] = (red, green, blue, 0)
    return image


def trim(image: Image.Image, pad: int = 12) -> Image.Image:
    bbox = image.getbbox()
    if not bbox:
        return image
    left = max(0, bbox[0] - pad)
    top = max(0, bbox[1] - pad)
    right = min(image.width, bbox[2] + pad)
    bottom = min(image.height, bbox[3] + pad)
    return image.crop((left, top, right, bottom))


def save_pose(image: Image.Image, name: str) -> Image.Image:
    cropped = trim(image)
    cropped.save(OUT / f"{name}.png", optimize=True)
    cropped.save(OUT / f"{name}.webp", quality=90, method=6)
    return cropped


def eye_centers(image: Image.Image) -> list[dict[str, float]]:
    """Two dark clusters in the upper half of the wave pose, as fractions."""
    width, height = image.size
    pixels = image.load()
    points: list[tuple[int, int]] = []
    for y in range(int(height * 0.18), int(height * 0.48)):
        for x in range(int(width * 0.25), int(width * 0.75)):
            red, green, blue, alpha = pixels[x, y]
            if alpha < 200:
                continue
            if red + green + blue < 180:
                points.append((x, y))
    if len(points) < 20:
        return []
    midpoint = width / 2
    groups = [[], []]
    for x, y in points:
        groups[0 if x < midpoint else 1].append((x, y))
    centers = []
    for group in groups:
        if not group:
            continue
        xs = [point[0] for point in group]
        ys = [point[1] for point in group]
        centers.append({"x": (sum(xs) / len(xs)) / width, "y": (sum(ys) / len(ys)) / height})
    return centers


def ascii_from_wave(image: Image.Image, columns: int = 22, rows: int = 16) -> list[str]:
    gray = image.convert("RGBA")
    fitted = gray.resize((columns, rows), Image.Resampling.BOX)
    pixels = fitted.load()
    ramp = " .:-=+*#%@"
    lines: list[str] = []
    for y in range(rows):
        chars = []
        for x in range(columns):
            red, green, blue, alpha = pixels[x, y]
            if alpha < 40:
                chars.append(" ")
                continue
            luma = (red * 3 + green * 6 + blue) / 10
            index = int((255 - luma) / 255 * (len(ramp) - 1))
            chars.append(ramp[max(0, min(len(ramp) - 1, index))])
        lines.append("".join(chars).rstrip())
    width = max(len(line) for line in lines)
    return [line.ljust(width) for line in lines]


def build_sheet() -> Image.Image:
    sheet = Image.open(SOURCE / "raft-mascot-sheet.jpg").convert("RGBA")
    boxes = {
        "raft-wave": (20, 80, 424, 600),
        "raft-raft": (400, 170, 900, 590),
        "raft-approve": (870, 90, 1275, 620),
    }
    wave = None
    for name, box in boxes.items():
        pose = save_pose(knock_out(sheet.crop(box)), name)
        if name == "raft-wave":
            wave = pose
    if wave is None:
        raise SystemExit("The wave pose was not cropped.")
    return wave


def build_wordmark() -> None:
    image = Image.open(SOURCE / "raft-wordmark.jpg").convert("RGBA")
    save_pose(knock_out(image.crop((240, 190, 1040, 510))), "raft-wordmark")
    save_pose(knock_out(image.crop((250, 200, 530, 490))), "raft-mark")


def build_icons() -> Image.Image:
    image = Image.open(SOURCE / "raft-app-icon.jpg").convert("RGBA")
    icon = trim(knock_out(image), pad=0)
    icon.save(OUT / "raft-app-icon.png", optimize=True)
    sizes = [16, 32, 180, 192, 512]
    resized = {size: icon.resize((size, size), Image.Resampling.LANCZOS) for size in sizes}
    for size, tile in resized.items():
        tile.save(OUT / f"raft-app-icon-{size}.png", optimize=True)
    resized[32].save(
        OUT / "favicon.ico",
        sizes=[(16, 16), (32, 32)],
        append_images=[resized[16]],
    )
    return resized[192]


def build_og(icon: Image.Image) -> None:
    canvas = Image.new("RGBA", (1200, 630), CREAM)
    wordmark = Image.open(OUT / "raft-wordmark.png").convert("RGBA")
    scale = 280 / wordmark.height
    wordmark = wordmark.resize((int(wordmark.width * scale), 280), Image.Resampling.LANCZOS)
    canvas.paste(wordmark, (72, (630 - wordmark.height) // 2 - 24), wordmark)
    corner = icon.resize((148, 148), Image.Resampling.LANCZOS)
    canvas.paste(corner, (1200 - 148 - 48, 48), corner)
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(str(FONT), 36) if FONT.exists() else ImageFont.load_default()
    draw.text((88, 470), "Sponsor Engine", font=font, fill=CHOCOLATE)
    canvas.convert("RGB").save(OUT / "og.png", optimize=True)


def build_manifest() -> None:
    manifest = {
        "name": "Sponsor Engine",
        "short_name": "Sponsor Engine",
        "icons": [
            {"src": "/brand/raft-app-icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/brand/raft-app-icon-512.png", "sizes": "512x512", "type": "image/png"},
        ],
        "theme_color": "#6B4A33",
        "background_color": "#FAF6EE",
        "display": "standalone",
    }
    (OUT / "manifest.webmanifest").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    wave = build_sheet()
    build_wordmark()
    icon = build_icons()
    build_og(icon)
    build_manifest()
    eyes = eye_centers(wave)
    (OUT / "raft-wave-eyes.json").write_text(json.dumps(eyes, indent=2) + "\n", encoding="utf-8")
    DOCS.mkdir(parents=True, exist_ok=True)
    wave.save(DOCS / "raft-hero.png", optimize=True)
    print("eyes", eyes)
    print("--- ascii ---")
    for line in ascii_from_wave(wave):
        print(line)
    # A soft edge check so a failed knockout is obvious.
    sample = wave.getpixel((0, 0))
    print("wave corner", sample, "size", wave.size)


if __name__ == "__main__":
    main()
