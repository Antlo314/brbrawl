"""Step 8 of the layering test (2026-10-30): a list of prompts -> finished, layered loops for the game's adaptive music (adaptive.js).

  python batch_tracks.py [prompts.txt] [--only name1,name2] [--dry-run]

prompts.txt (default: music/ace_test/prompts.txt), one track per line; a # at the start of a line or after a space starts a comment
(so "F# minor" is a key, not a comment), blank lines are skipped, and | separates the fields:
  name | BPM | key | style | mood [| seed=7 seconds=120 bars=16 caption=<the whole caption, instead of style + mood>]
  ghost_haunted_90 | 90 | C minor | dark haunted trap with a music box and church bells | eerie, creeping, Halloween night

Three passes over the list. Each skips what's already on disk, so running it again picks up where a failed run stopped, and nothing is ever
overwritten:
1. Generate: ACE-Step 1.5 XL turbo in ComfyUI on D: (the recipe picked in the A/B, test C2). The caption is the style and mood plus the
   instruments the game's layers are cut from (drums, 808, piano, bells, synth), recorded-instrument wording, instrumental; section
   markers steer the arrangement (piano and bells, then drums and 808 come in, then the full hook). 4/4. Same name = same seed = same
   track. -> source/<name>.flac + <name>.json (every setting). Starts the ACE server if it's down and stops it after this pass (it holds
   about 11 GB of the 12 GB GPU, and Demucs needs the GPU next); a server that was already running is only asked to free its memory.
2. Split: Demucs htdemucs_6s on the GPU (float WAVs on D:\\demucs\\out) -> stems/<name>/<stem>.flac, 24-bit 44.1 kHz.
3. Loops: make_loops.py -> stems/<name>/loop/ (six layers as OGG + M4A, loop.json) and previews/<name>_demo.mp3 (story -> + percussion
   -> boss, one loop each). A track a hair off its BPM is landed on it exactly (--conform), and every track is levelled to the first
   beat's loudness (-14 LUFS, peak at most -1 dB), so tracks in a mode switch on one grid without jumps in level.
Then reports/batch_<date>_<time>.txt (each track: what happened, tempo, loop window, how loud each layer is, any layer that came out
nearly silent) and tracks.json, the list of finished tracks (rebuilt from what's on disk every run).
"""
import argparse, json, os, re, subprocess, sys, time, urllib.request, zlib
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ACE_TEST = os.path.dirname(HERE)                                   # global-reset-fighter/music/ace_test
SOURCE, STEMS, PREVIEWS, REPORTS = (os.path.join(ACE_TEST, d) for d in ('source', 'stems', 'previews', 'reports'))
FF = r'C:\ffmpeg\bin\ffmpeg.exe'
COMFY, PORT = r'D:\ComfyUI', 8189
UNET = 'acestep_v1.5_xl_turbo_bf16.safetensors'
GAIN_DB = -6      # turned down before saving: Comfy's decoder evens out the level and a dense track's peaks then clip (ghost_fight_90's did)
LUFS = -14.0      # every loop's full mix, like the first test beat (-14.1)
DEMUCS_PY, DEMUCS_OUT, TORCH_HOME = r'D:\demucs\.venv\Scripts\python.exe', r'D:\demucs\out', r'D:\demucs\torch_home'
STEM_NAMES = ['drums', 'bass', 'piano', 'other', 'guitar', 'vocals']
sys.path.insert(0, COMFY)

# The instruments the game's layers come from (drums_core / perc, bass_808, piano, synth / bells), named as real, recorded ones: the
# wording that took the user's A/B (test C) from "computerized" to usable.
CAPTION = ('{style}, instrumental at {bpm} BPM in {key}. Mood: {mood}. Like a fighting game soundtrack recorded by a hip-hop producer with '
           'live session players: hard live drums with a tight snare and trap hi-hat rolls, a deep 808 bass, a concert grand piano, real '
           'bells and a warm analog synth pad. Big, polished studio mix with natural reverb, instrumental, no vocals.')
# Step 3's section markers (no words = no vocals): every layer gets a part, and the hook has all of them at once for the loop
STRUCT = ('[Intro - solo grand piano and ringing bells]\n\n[Verse - hard live drums and deep 808 bass come in]\n\n'
          '[Hook - full arrangement, bells and synth pad swell]\n\n[Outro - piano and bells alone]')
KEY = re.compile(r'^[A-G][#b]? (major|minor)$')

def read_prompts(path):
    tracks, seen = [], set()
    for n, line in enumerate(open(path, encoding='utf-8'), 1):
        line = re.split(r'(?:^|\s)#', line, maxsplit=1)[0].strip()   # "F# minor" keeps its #
        if not line: continue
        f = [x.strip() for x in line.split('|')]
        if len(f) < 5: sys.exit(f'{path}:{n}: needs name | BPM | key | style | mood')
        name, bpm, key, style, mood = f[:5]
        extra = dict(re.findall(r'(\w+)=("[^"]*"|.+?)(?=\s+\w+=|$)', f[5])) if len(f) > 5 else {}
        if not re.fullmatch(r'[a-z0-9_]{2,60}', name): sys.exit(f'{path}:{n}: name "{name}": use a-z, 0-9 and _')
        if name in seen: sys.exit(f'{path}:{n}: "{name}" is in the list twice')
        if not (bpm.isdigit() and 60 <= int(bpm) <= 180): sys.exit(f'{path}:{n}: BPM "{bpm}": a whole number from 60 to 180')
        if not KEY.match(key): sys.exit(f'{path}:{n}: key "{key}": like "C minor" or "F# major"')
        seen.add(name)
        t = dict(name=name, bpm=int(bpm), key=key, style=style, mood=mood, seconds=float(extra.get('seconds', 120)), bars=int(extra.get('bars', 16)),
                 seed=int(extra['seed']) if 'seed' in extra else zlib.crc32(name.encode()) & 0x7fffffff)   # the same name always makes the same track
        t['caption'] = extra['caption'].strip('"') if 'caption' in extra else CAPTION.format(**{**t, 'style': style[:1].upper() + style[1:]})
        tracks.append(t)
    return tracks

# ---------- the ACE server (ComfyUI on D:, port 8189) ----------
def server_up():
    try: urllib.request.urlopen(f'http://127.0.0.1:{PORT}/system_stats', timeout=3); return True
    except Exception: return False

def server_pids():
    """the ACE server's process: found by its command line (main.py ... --port 8189), since netstat can list its listening socket under PID 0
    (Windows does that once the launcher that opened it has exited), plus whatever netstat does show listening on PORT"""
    ps = subprocess.run(['powershell', '-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
                         f"Where-Object {{ $_.CommandLine -like '*main.py*--port {PORT}*' }} | ForEach-Object {{ $_.ProcessId }}"], capture_output=True, text=True).stdout
    out = subprocess.run(['netstat', '-ano', '-p', 'TCP'], capture_output=True, text=True).stdout
    listen = {int(f[4]) for f in (l.split() for l in out.splitlines()) if len(f) >= 5 and f[1].endswith(f':{PORT}') and f[3] == 'LISTENING'}
    return ({int(x) for x in ps.split() if x.isdigit()} | listen) - {0}

STARTED = set()   # the server's process, noted when this run started it
def start_server():
    print('starting the ACE server (D:\\ComfyUI\\start_comfy_ace.bat)...', flush=True)
    subprocess.Popen(['cmd', '/c', os.path.join(COMFY, 'start_comfy_ace.bat')], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS)
    t = time.time()
    while time.time() - t < 400:
        if server_up(): STARTED.update(server_pids()); print(f'  up in {time.time() - t:.0f} s', flush=True); return
        time.sleep(3)
    sys.exit('the ACE server did not come up in 400 s: see D:\\ComfyUI\\comfy_ace.log')

def stop_server():
    pids = set()
    for _ in range(5):
        pids |= server_pids() | STARTED
        for pid in pids: subprocess.run(['taskkill', '/PID', str(pid), '/T', '/F'], capture_output=True)
        time.sleep(1)
        if not server_up(): print(f'stopped the ACE server (PID {", ".join(map(str, sorted(pids)))})', flush=True); return
    print(f'could NOT stop the ACE server on port {PORT} (tried PID {", ".join(map(str, sorted(pids))) or "none found"}): it still holds the GPU', flush=True)

def free_server():   # it was running before the batch: leave it up, just let go of the GPU
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}/free', data=json.dumps({'unload_models': True, 'free_memory': True}).encode(), headers={'Content-Type': 'application/json'})
    try: urllib.request.urlopen(req, timeout=30); print('asked the running ACE server to free the GPU', flush=True)
    except Exception as e: print(f'could not ask the ACE server to free the GPU ({e}); Demucs may run short of GPU memory', flush=True)

# ---------- the three passes ----------
def generate(t):
    from ace_gen import generate as ace
    out = os.path.join(SOURCE, f'{t["name"]}.flac')
    r = ace(t['caption'], t['bpm'], t['seconds'], t['key'], t['seed'], out, True, PORT, STRUCT, quiet=True, unet=UNET, weight_dtype='default', gain_db=GAIN_DB)
    settings = dict(model=f'{UNET} (bf16)', planner='qwen_1.7b_ace15', caption=t['caption'], lyrics=STRUCT, style=t['style'], mood=t['mood'], bpm=t['bpm'],
                    key=t['key'], time_signature='4/4', seconds=t['seconds'], seed=t['seed'], gain_db=GAIN_DB, steps=8, cfg=1.0, sampler='euler/simple', shift=3.0,
                    seconds_taken=round(r['seconds_taken'], 1), peak_vram_gb=round(r['peak_vram_gb'], 1), made=f'{time.strftime("%Y-%m-%d")} with tools/batch_tracks.py')
    with open(os.path.join(SOURCE, f'{t["name"]}.json'), 'x', encoding='utf-8') as f: json.dump(settings, f, indent=2)
    return f'{r["seconds_taken"]:.0f} s, peak GPU {r["peak_vram_gb"]:.1f} GB'

def split(t):
    name, dst = t['name'], os.path.join(STEMS, t['name'])
    raw = os.path.join(DEMUCS_OUT, 'htdemucs_6s', name)
    took = 'Demucs skipped (its WAVs were on D:)'
    if not all(os.path.exists(os.path.join(raw, f'{s}.wav')) for s in STEM_NAMES):
        env = dict(os.environ, TORCH_HOME=TORCH_HOME, PATH=os.path.dirname(FF) + os.pathsep + os.environ['PATH'])
        t0 = time.time()
        p = subprocess.run([DEMUCS_PY, '-m', 'demucs', '-n', 'htdemucs_6s', '-d', 'cuda', '--shifts', '2', '--float32', '--clip-mode', 'none',
                            '-o', DEMUCS_OUT, '--filename', '{track}/{stem}.{ext}', os.path.join(SOURCE, f'{name}.flac')], env=env, capture_output=True, text=True)
        if p.returncode: raise RuntimeError('Demucs failed: ' + (p.stderr or p.stdout)[-1500:])
        took = f'Demucs {time.time() - t0:.0f} s'
    os.makedirs(dst, exist_ok=True)
    for s in STEM_NAMES:                                           # 24-bit FLAC, like the first track's stems
        out = os.path.join(dst, f'{s}.flac')
        if not os.path.exists(out):
            subprocess.run([FF, '-v', 'error', '-n', '-i', os.path.join(raw, f'{s}.wav'), '-c:a', 'flac', '-sample_fmt', 's32', '-bits_per_raw_sample', '24', out], check=True)
    return took

def loops(t):
    stems, loop = os.path.join(STEMS, t['name']), os.path.join(STEMS, t['name'], 'loop')
    demo = os.path.join(PREVIEWS, f'{t["name"]}_demo.mp3')
    cmd = [sys.executable, os.path.join(HERE, 'make_loops.py'), stems, loop, '--bpm', str(t['bpm']), '--bars', str(t['bars']), '--m4a', '--conform', '--lufs', str(LUFS)] +           ([] if os.path.exists(demo) else ['--demo', demo])
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode: raise RuntimeError('make_loops failed: ' + (p.stderr or p.stdout)[-1500:])
    grids = re.findall(r'beat grid: ([\d.]+) BPM', p.stdout); win = re.search(r'loop: bars (\d+)\.\.(\d+), starts at ([\d.]+) s', p.stdout)
    snap = re.search(r'playing it ([+-][\d.]+%) \(([+-][\d.]+) cents\)', p.stdout); lev = re.search(r'-> ([+-][\d.]+) dB on every layer -> ([-\d.]+) LUFS', p.stdout)
    tempo = f'{grids[0]} -> {grids[-1]} BPM (snapped: {snap.group(1)}, {snap.group(2)} cents)' if snap else f'{grids[-1] if grids else "?"} BPM'
    return (f'tempo {tempo}, loop = bars {win.group(1)}-{win.group(2)} from {win.group(3)} s' + (f', levelled {lev.group(1)} dB to {lev.group(2)} LUFS' if lev else '')
            if win else p.stdout.strip().splitlines()[-1])

def layer_levels(name):
    """Each layer's level over the loop (dB RMS), from the OGGs between their pads"""
    d = os.path.join(STEMS, name, 'loop'); info = json.load(open(os.path.join(d, 'loop.json'), encoding='utf-8'))
    P, L, out = info.get('pad_samples', 0), info['samples'], {}
    for n in info['layers']:
        raw = subprocess.run([FF, '-v', 'error', '-i', os.path.join(d, f'{n}.ogg'), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
        x = np.frombuffer(raw, np.float32).reshape(-1, 2)[P:P + L].astype(np.float64)
        out[n] = round(20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12), 1)
    return out

def rebuild_index():
    """tracks.json: every finished track (its loop folder, preview and the settings it was made with), read from disk"""
    rows = []
    for name in sorted(os.listdir(STEMS)):
        lj = os.path.join(STEMS, name, 'loop', 'loop.json')
        if not os.path.exists(lj): continue
        info, sj = json.load(open(lj, encoding='utf-8')), os.path.join(SOURCE, f'{name}.json')
        src = json.load(open(sj, encoding='utf-8')) if os.path.exists(sj) else {}
        rows.append(dict(name=name, bpm=info['bpm'], key=src.get('key'), style=src.get('style'), mood=src.get('mood'), bars=info['bars'], seconds=info['seconds'],
                         loop=f'music/ace_test/stems/{name}/loop/', preview=f'music/ace_test/previews/{name}_demo.mp3' if os.path.exists(os.path.join(PREVIEWS, f'{name}_demo.mp3')) else None))
    with open(os.path.join(ACE_TEST, 'tracks.json'), 'w', encoding='utf-8') as f: json.dump({'made_by': 'tools/batch_tracks.py (rebuilt every run)', 'tracks': rows}, f, indent=2)
    return len(rows)

def main():
    ap = argparse.ArgumentParser(description='prompts -> ACE-Step tracks -> Demucs stems -> game loops, into music/ace_test')
    ap.add_argument('prompts', nargs='?', default=os.path.join(ACE_TEST, 'prompts.txt'))
    ap.add_argument('--only', help='comma-separated names: just these tracks from the list')
    ap.add_argument('--dry-run', action='store_true', help='show what each track would be made with; make nothing')
    a = ap.parse_args()
    tracks = read_prompts(a.prompts)
    if a.only:
        want = set(a.only.split(',')); missing = want - {t['name'] for t in tracks}
        if missing: sys.exit(f'not in {a.prompts}: {", ".join(sorted(missing))}')
        tracks = [t for t in tracks if t['name'] in want]
    if not tracks: sys.exit(f'no tracks in {a.prompts}')
    for t in tracks:
        t['have'] = dict(source=os.path.exists(os.path.join(SOURCE, f'{t["name"]}.flac')),
                         stems=all(os.path.exists(os.path.join(STEMS, t['name'], f'{s}.flac')) for s in STEM_NAMES),
                         loops=os.path.exists(os.path.join(STEMS, t['name'], 'loop', 'loop.json')))
    if a.dry_run:
        for t in tracks:
            done = [k for k, v in t['have'].items() if v]
            print(f'\n{t["name"]}: {t["bpm"]} BPM, {t["key"]}, {t["seconds"]:.0f} s, seed {t["seed"]}, {t["bars"]}-bar loop'
                  f'{" (already has: " + ", ".join(done) + ")" if done else ""}\n  {t["caption"]}')
        return
    for d in (SOURCE, STEMS, PREVIEWS, REPORTS): os.makedirs(d, exist_ok=True)
    log = {t['name']: [] for t in tracks}
    failed = set()
    def run(stage, fn, t):
        t0 = time.time()
        print(f'[{stage}] {t["name"]}...', flush=True)
        try: msg = fn(t); log[t['name']].append(f'{stage}: {msg}'); print(f'  {msg} ({time.time() - t0:.0f} s)', flush=True)
        except Exception as e: failed.add(t['name']); log[t['name']].append(f'{stage}: FAILED: {e}'); print(f'  FAILED: {e}', flush=True)

    todo = [t for t in tracks if not t['have']['source']]
    if todo:
        started = False
        if not server_up(): start_server(); started = True
        try:
            for t in todo: run('generate', generate, t)
        finally:
            stop_server() if started else free_server()
    for t in tracks:
        if t['have']['source']: log[t['name']].append('generate: already there')
    for t in tracks:
        if t['name'] in failed: continue
        if t['have']['stems']: log[t['name']].append('split: already there'); continue
        run('split', split, t)
    for t in tracks:
        if t['name'] in failed: continue
        if t['have']['loops']: log[t['name']].append('loops: already there'); continue
        run('loops', loops, t)

    lines = [f'batch {time.strftime("%Y-%m-%d %H:%M")}: {len(tracks)} track(s) from {a.prompts}', '']
    for t in tracks:
        lines.append(f'{t["name"]}  ({t["bpm"]} BPM, {t["key"]}, seed {t["seed"]}){"  FAILED" if t["name"] in failed else ""}')
        lines += [f'  {m}' for m in log[t['name']]]
        if t['name'] not in failed:
            lv = layer_levels(t['name']); quiet = [n for n, v in lv.items() if v < -50]
            lines.append('  layers (dB RMS): ' + ', '.join(f'{n} {v}' for n, v in lv.items()))
            if quiet: lines.append(f'  NOTE: nearly silent in the loop: {", ".join(quiet)} (that layer will add little in the game)')
            lines.append(f'  listen: music/ace_test/previews/{t["name"]}_demo.mp3')
        lines.append('')
    lines.append(f'tracks.json: {rebuild_index()} finished track(s)')
    report = os.path.join(REPORTS, f'batch_{time.strftime("%Y%m%d_%H%M%S")}.txt')
    with open(report, 'x', encoding='utf-8') as f: f.write('\n'.join(lines) + '\n')
    print('\n' + '\n'.join(lines) + f'\nreport: {report}')
    sys.exit(1 if failed else 0)

if __name__ == '__main__':
    main()
