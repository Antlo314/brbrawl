"""Turn a raw depth take of a stage (Gemini, prompt in stages.js's notes) into the depth.png the glow pass reads.
Usage: python make-depth.py <raw depth take> <stage.jpg> <out depth.png>
  Harlem: python make-depth.py ../originals/gemini/depth_harlem_a.png art/stage.jpg art/depth.png
The take is first lined up with stage.jpg (it's drawn freehand, so it can sit a pixel or two off or be a hair bigger): the
outlines of both are matched over small stretches and shifts.
Encoding: 128 = the fighters' floor line (y 468, d = 1), 0 = the farthest thing (stages.js depth.far), 255 = the nearest (depth.near).
The map is cleaned (window and brick lines, string-light bulbs and speaker cones out), near things are grown a few pixels so the
stretch at their edges lands in the background behind them, then softened so the picture bends instead of tearing.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

W, H, GROUND = 960, 540, 468
src, stage_path, out = sys.argv[1], sys.argv[2], sys.argv[3]


def place(a, sx, sy, dx, dy):
    """a stretched by sx, sy about the center and moved by dx, dy (edge pixels repeat where it runs short)"""
    xs = np.clip(np.round((np.arange(W) - W / 2 - dx) / sx + W / 2), 0, W - 1).astype(int)
    ys = np.clip(np.round((np.arange(H) - H / 2 - dy) / sy + H / 2), 0, H - 1).astype(int)
    return a[np.ix_(ys, xs)]


def edges(a):
    e = np.zeros_like(a)
    e[:-1, :-1] = np.abs(np.diff(a, axis=1))[:-1] + np.abs(np.diff(a, axis=0))[:, :-1]
    e[:24], e[-24:], e[:, :24], e[:, -24:] = 0, 0, 0, 0  # the frame's own border tells nothing
    return (e - e.mean()) / (e.std() + 1e-6)


raw = np.asarray(Image.open(src).convert('L').resize((W, H), Image.LANCZOS), dtype=np.float32)
art = np.asarray(Image.open(stage_path).convert('L').resize((W, H), Image.LANCZOS), dtype=np.float32)
fa = np.fft.rfft2(edges(art))
best = None
STRETCH = [round(0.98 + 0.005 * i, 3) for i in range(9)]  # 0.98 … 1.02
for sx in STRETCH:
    for sy in STRETCH:
        c = np.fft.irfft2(fa * np.conj(np.fft.rfft2(edges(place(raw, sx, sy, 0, 0)))), s=(H, W))
        c = np.roll(np.roll(c, 16, 0), 16, 1)[:33, :33]  # shifts of -16 … 16
        dy, dx = np.unravel_index(np.argmax(c), c.shape)
        if best is None or c[dy, dx] > best[0]: best = (c[dy, dx], sx, sy, dx - 16, dy - 16)
_, sx, sy, dx, dy = best
v0 = place(raw, sx, sy, dx, dy)

im = Image.fromarray(v0.astype(np.uint8)).filter(ImageFilter.MedianFilter(7))
im = im.filter(ImageFilter.MinFilter(11)).filter(ImageFilter.MaxFilter(11))  # small specks out (string-light bulbs)
im = im.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))    # small holes filled (speaker cones)
im = im.filter(ImageFilter.MaxFilter(7))                                      # near things grown a little
v = np.asarray(im, dtype=np.float32)

vg = float(np.median(v[GROUND, 150:810]))   # the floor under the fighters
vf = float(np.percentile(v, 1))              # sky / the far end
vn = float(np.percentile(v[GROUND:], 99.5))  # the bottom edge of the floor
enc = np.where(v < vg, 128 * np.clip((v - vf) / max(vg - vf, 1), 0, 1), 128 + 127 * np.clip((v - vg) / max(vn - vg, 1), 0, 1))
enc[GROUND:] = np.maximum(enc[GROUND:], 128)  # nothing below the floor line is behind the fighters
e = Image.fromarray(np.clip(enc, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
e.save(out, optimize=True)
print(f'lined up: stretch {sx:.3f} x {sy:.3f}, moved {dx:+d}, {dy:+d}; floor {vg:.0f}, far {vf:.0f}, near {vn:.0f} -> {out}')
