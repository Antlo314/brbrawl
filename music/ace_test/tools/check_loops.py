"""Check a loop folder made by make_loops.py: every layer decodes to the same sample count, the seam (end -> start) is as smooth as the
rest of the audio, and the layers add up to mix_all.ogg. With pads (loop.json pad_samples) the loop is the part between them, and each pad
must hold the loop's own other end.   python check_loops.py <loop folder> [ogg|m4a]"""
import json, os, subprocess, sys
import numpy as np

FF = r'C:\ffmpeg\bin\ffmpeg.exe'
d = sys.argv[1]
info = json.load(open(os.path.join(d, 'loop.json'), encoding='utf-8'))
def load(p):
    raw = subprocess.run([FF, '-v', 'error', '-i', p, '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
db = lambda v: 20 * np.log10(max(v, 1e-12))
P, L = info.get('pad_samples', 0), info['samples']
def loop(x, name):
    if P:
        pad_err = max(np.abs(x[:P] - x[L:P + L]).max(), np.abs(x[P + L:P + L + P] - x[P:2 * P]).max())
        print(f'{name:11s} file {len(x)} samples = pad {P} + loop {L} + pad {len(x) - P - L}; pads match the loop ends to {pad_err:.4f}')
    return x[P:P + L]
ext = sys.argv[2] if len(sys.argv) > 2 else 'ogg'
layers = {n: loop(load(os.path.join(d, f'{n}.{ext}')), n) for n in info['layers']}
mix = loop(load(os.path.join(d, f'mix_all.{ext}')), 'mix_all')
for n, x in list(layers.items()) + [('mix_all', mix)]:
    jumps = np.abs(np.diff(x, axis=0)).max(axis=1)
    seam = np.abs(x[0] - x[-1]).max()
    print(f'{n:11s} {len(x)} samples ({len(x) / info["sample_rate"]:.3f} s)  RMS {db(np.sqrt(np.mean(x ** 2))):6.1f} dB  peak {db(np.abs(x).max()):6.1f} dB  '
          f'seam jump {seam:.4f} vs typical {np.percentile(jumps, 50):.4f} / 99.9% {np.percentile(jumps, 99.9):.4f}')
same = len({len(x) for x in layers.values()} | {len(mix)}) == 1
print('all the same length:', same, '| expected', info['samples'])
s = sum(layers.values())
print(f'layers summed vs mix_all: difference {db(np.sqrt(np.mean((s - mix) ** 2))) - db(np.sqrt(np.mean(mix ** 2))):.1f} dB (lossy encoding only)')
