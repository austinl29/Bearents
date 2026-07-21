"""Draws the Bearents app icon: a gradient background + a simple bear face
built from PIL primitives (no emoji/font glyph rendering, which is fragile
across machines). Supersamples at 2048px and downsamples for clean edges.

Usage: python3 scripts/generate_icons.py
Then: sips -z 192 192 public/icons/icon-512.png --out public/icons/icon-192.png
"""
from PIL import Image, ImageDraw
import os

SIZE = 2048
HONEY = (246, 169, 59)
HONEY_DARK = (216, 132, 15)
FUR = (243, 214, 173)
FUR_DARK = (214, 179, 133)
INK = (64, 42, 31)
ROSE = (232, 135, 125)
WHITE = (255, 250, 244)

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(OUT_DIR, exist_ok=True)

img = Image.new("RGB", (SIZE, SIZE), HONEY)
draw = ImageDraw.Draw(img)

# Vertical gradient background.
for y in range(SIZE):
    t = y / (SIZE - 1)
    r = int(HONEY[0] + (HONEY_DARK[0] - HONEY[0]) * t)
    g = int(HONEY[1] + (HONEY_DARK[1] - HONEY[1]) * t)
    b = int(HONEY[2] + (HONEY_DARK[2] - HONEY[2]) * t)
    draw.line([(0, y), (SIZE, y)], fill=(r, g, b))

cx, cy = SIZE // 2, SIZE // 2 + 70

# Ears (outer + inner).
ear_r, inner_ear_r = 210, 105
ear_off_x, ear_off_y = 300, 300
for sign in (-1, 1):
    ex, ey = cx + sign * ear_off_x, cy - ear_off_y
    draw.ellipse([ex - ear_r, ey - ear_r, ex + ear_r, ey + ear_r], fill=FUR_DARK)
    draw.ellipse([ex - inner_ear_r, ey - inner_ear_r, ex + inner_ear_r, ey + inner_ear_r], fill=ROSE)

# Head.
head_r = 480
draw.ellipse([cx - head_r, cy - head_r, cx + head_r, cy + head_r], fill=FUR)

# Snout.
snout_w, snout_h = 260, 190
snout_cy = cy + 190
draw.ellipse([cx - snout_w, snout_cy - snout_h, cx + snout_w, snout_cy + snout_h], fill=WHITE)

# Eyes.
eye_r = 44
eye_off_x, eye_off_y = 190, 40
for sign in (-1, 1):
    exx, eyy = cx + sign * eye_off_x, cy - eye_off_y
    draw.ellipse([exx - eye_r, eyy - eye_r, exx + eye_r, eyy + eye_r], fill=INK)

# Nose.
nose_w, nose_h = 66, 46
nose_cy = snout_cy - 70
draw.ellipse([cx - nose_w, nose_cy - nose_h, cx + nose_w, nose_cy + nose_h], fill=INK)

master_512 = img.resize((512, 512), Image.LANCZOS)
master_512.save(os.path.join(OUT_DIR, "icon-512.png"))
print("Wrote", os.path.join(OUT_DIR, "icon-512.png"))
