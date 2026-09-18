"""
Regenerates the app icons from the master brand image (frontend/public/logo.png).

The master is a square, full-bleed logo. Run this after changing it:
    python mobile-app/scripts/generate-assets.py
"""
import os

from PIL import Image, ImageDraw

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.join(SCRIPT_DIR, "..", "..", "frontend", "public", "logo.png")
OUT_DIR = os.path.join(SCRIPT_DIR, "..", "assets", "images")


def square(size):
    """The master logo as an opaque square of the given size."""
    return Image.open(MASTER).convert("RGB").resize((size, size), Image.LANCZOS)


def rounded_tile(size, radius_ratio=0.22):
    """The logo as an app-style tile: rounded corners, transparent outside them."""
    image = square(size).convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    image.putalpha(mask)
    return image


def glow_only(size, scale=0.62, floor=48, ceiling=120):
    """
    The neon artwork on a transparent background, centred inside the adaptive-icon safe zone.
    Pixels darker than `floor` become fully transparent and the glow ramps up to opaque by
    `ceiling`, so the art fades out instead of sitting on a dark square.
    """
    art = square(int(size * scale)).convert("RGBA")
    pixels = art.load()
    span = max(1, ceiling - floor)
    for y in range(art.height):
        for x in range(art.width):
            r, g, b, _ = pixels[x, y]
            alpha = int(max(0, max(r, g, b) - floor) * 255 / span)
            pixels[x, y] = (r, g, b, min(255, alpha))
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(art, ((size - art.width) // 2, (size - art.height) // 2), art)
    return canvas


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    outputs = {
        "icon.png": square(1024),                  # iOS/Android app icon (full bleed, no alpha)
        "splash-icon.png": rounded_tile(512),      # Splash screen tile
        "android-icon-foreground.png": glow_only(1024),  # Adaptive icon foreground
        "favicon.png": square(96),                 # Web favicon
    }
    for name, image in outputs.items():
        path = os.path.join(OUT_DIR, name)
        image.save(path)
        print(f"Wrote {name} ({image.size[0]}x{image.size[1]})")
    print("Asset generation complete!")
