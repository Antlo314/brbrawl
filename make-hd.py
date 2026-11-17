"""The HD sprite set: every active battler's sheets, pose pairs and smooth sheets (all looks), upscaled 2x with Real-ESRGAN
(the anime model at 4x, then halved, which keeps faces truest) into sprites-hd/<id>/<look>/. Big screens load these (game.js,
loadSprites); phones and small windows keep sprites/. The 8-frame formula sheets (anim_*, smooth_walk, smooth_idle) are drawn big already and stay put.
  python make-hd.py            (skips files already made; needs MM Game/tools/realesrgan)
"""
import os, re, shutil, subprocess, sys, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SPR, HD = os.path.join(HERE, 'sprites'), os.path.join(HERE, 'sprites-hd')
TOOL = os.path.join(os.path.dirname(HERE), 'tools', 'realesrgan')
ACTIVE = re.search(r"ACTIVE_ROSTER = (\[[^\]]*\])", open(os.path.join(HERE, 'fighters.js'), encoding='utf-8').read()).group(1)
ACTIVE = [x.strip(" '\"") for x in ACTIVE.strip('[]').split(',') if x.strip()] + ['dummy']
# (the 8-frame walk and idle and the anim_ sheets are drawn big already: the old smooth jab is the only smooth sheet that needs it)
WANT = re.compile(r'^(sheet_\d|p_[a-z0-9_]+|smooth_punch)\.jpg$')

todo = []
for bid in ACTIVE:
    for look in ['', 'o2', 'o3', 'o4']:
        d = os.path.join(SPR, bid, look)
        if not os.path.isdir(d): continue
        for f in sorted(os.listdir(d)):
            if WANT.match(f) and not os.path.exists(os.path.join(HD, bid, look, f)): todo.append((bid, look, f))
print(len(todo), 'files to upscale')
if not todo: sys.exit(0)
stage = tempfile.mkdtemp(prefix='hd_in_'); out = tempfile.mkdtemp(prefix='hd_out_')
for bid, look, f in todo: shutil.copy(os.path.join(SPR, bid, look, f), os.path.join(stage, f'{bid}~{look}~{f}'))
subprocess.run([os.path.join(TOOL, 'realesrgan-ncnn-vulkan.exe'), '-i', stage, '-o', out, '-n', 'realesrgan-x4plus-anime',
                '-m', os.path.join(TOOL, 'models'), '-f', 'png'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for bid, look, f in todo:
    src = os.path.join(out, f'{bid}~{look}~{f}'[:-4] + '.png')
    if not os.path.exists(src): print('missing', bid, look, f); continue
    w, h = Image.open(os.path.join(SPR, bid, look, f)).size
    im = Image.open(src).convert('RGB').resize((w * 2, h * 2), Image.LANCZOS)
    os.makedirs(os.path.join(HD, bid, look), exist_ok=True); im.save(os.path.join(HD, bid, look, f), quality=88)
shutil.rmtree(stage, ignore_errors=True); shutil.rmtree(out, ignore_errors=True)
print('done')
