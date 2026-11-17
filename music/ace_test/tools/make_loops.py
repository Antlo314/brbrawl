"""Step 5 of the layering test (2026-10-30): cut a track's Demucs stems into one seamless, bar-aligned loop per layer and save them as OGG.

  python make_loops.py <stems folder with drums/bass/piano/other .wav or .flac> <out folder> [--bpm 90] [--bars 16] [--m4a] [--add]
                       [--conform] [--lufs -14]

  --m4a      also writes each layer as AAC .m4a (Safari before iOS/macOS 17 can't decode OGG Vorbis; the game falls back to these)
  --add      for a folder made earlier: writes only the files that aren't there yet (e.g. --m4a --add), never touching the rest
  --conform  a track that came out a hair off --bpm (up to 1%: ACE once gave 89.87 for 90) is sped up or slowed to land on it exactly,
             so tracks meant to switch into each other share one grid (by resampling: 90/89.87 is +2.5 cents of pitch, below hearing)
  --lufs     levels the track so its full mix sits at this loudness (the first test beat is -14.1), never letting the mix peak above
             -1 dBFS: tracks then switch without jumps in level. The gain goes to every layer alike, so their balance is kept

1. Locks the beat grid (tempo and phase, to the millisecond) from the drum stem's hits.
2. Finds beat 1 of the bar: where the drums first come in (a section start), checked against where the kick lands.
3. Measures every layer bar by bar and picks the run of bars (starting on a 4-bar phrase) where all of them play.
4. Cuts every stem at the same sample positions, so the layers stay locked together; the loop length is a whole number of samples.
5. Hides the loop seam: the first 20 ms are crossfaded with the audio that followed the loop's end, so the end runs straight into the start.
   Each file then carries PAD samples of the loop's own end before it and its own start after it (loop.json pad_samples; see PAD).
6. Splits two stems so the game gets the layers asked for: drums -> core drums (kick, snare) + extra percussion (hats, rolls, cymbals) at
   ~4-7 kHz; other -> synth (pads, strings, brass) + bells (the bright part: bells, glockenspiel, shimmer) at ~1.2-2.5 kHz. The splits are
   complementary, so each pair adds back to the stem it came from, and done around the whole loop, so they loop seamlessly too.
7. Encodes each layer with ffmpeg (libvorbis q5, 44.1 kHz stereo; with --m4a also AAC 160k), plus the full mix, and writes loop.json for the game.
Also renders a listening demo: the loop three times, story layers -> + percussion -> boss (everything), fading layers over one beat.
"""
import argparse, json, os, subprocess, sys
import numpy as np

FF = r'C:\ffmpeg\bin\ffmpeg.exe'
SR = 44100
# Every file holds the loop with PAD samples of its own end before it and of its own start after it; the game loops between the two pad
# marks (loop.json pad_samples). A browser resamples each file to its own rate on its own (44.1 -> 48 kHz) and smears the first and last
# few samples against silence, and AAC decoders trim the ends differently (Chrome decodes a few samples short): all of that lands in the
# pads, which never play, so the loop point stays seamless.
PAD = 4096

def load(path, speed=1.0):
    """stereo float at SR; speed != 1 plays it that much faster (and that much higher) by resampling, for --conform"""
    af = ['-af', f'aresample={SR},asetrate={int(round(SR * speed))},aresample={SR}'] if speed != 1 else []
    raw = subprocess.run([FF, '-v', 'error', '-i', path, *af, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)

def lufs(x):
    """integrated loudness (EBU R128, ffmpeg's ebur128) of a stereo float signal"""
    p = subprocess.run([FF, '-hide_banner', '-nostats', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-af', 'ebur128', '-f', 'null', '-'],
                       input=x.astype(np.float32).tobytes(), capture_output=True)
    v = [l.split()[1] for l in p.stderr.decode(errors='replace').splitlines() if l.strip().startswith('I:')]
    return float(v[-1])

def find(folder, name):
    for ext in ('wav', 'flac'):
        p = os.path.join(folder, f'{name}.{ext}')
        if os.path.exists(p): return p
    sys.exit(f'missing {name} in {folder}')

def onset_env(x, hop=128, win=1024):
    m = x.mean(axis=1)
    frames = np.lib.stride_tricks.sliding_window_view(m, win)[::hop] * np.hanning(win)
    mag = np.abs(np.fft.rfft(frames, axis=1))
    f = np.maximum(0, np.diff(np.log1p(mag * 10), axis=0)).sum(axis=1)
    return np.concatenate([[0], f]), hop

def lock_grid(drums, bpm0):
    env, hop = onset_env(drums)
    fps = SR / hop
    best = (-1, bpm0, 0.0)
    for bpm in np.arange(bpm0 - 0.2, bpm0 + 0.2001, 0.01):
        period = 60 / bpm
        beats = np.arange(0, len(env) / fps - period, period)
        for ph in np.arange(0, period, 0.002):
            idx = np.round((beats + ph) * fps).astype(int)
            idx = idx[idx < len(env)]
            s = env[idx].mean()
            if s > best[0]: best = (s, bpm, ph)
    return best[1], best[2]

def lowband_energy(x, centers, lo=30, hi=140, before=0.03, after=0.08):
    out = []
    for c in centers:
        a, b = int(max(0, (c - before) * SR)), int(min(len(x), (c + after) * SR))
        seg = x[a:b].mean(axis=1)
        if len(seg) < 64: out.append(0); continue
        sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
        fr = np.fft.rfftfreq(len(seg), 1 / SR)
        out.append(sp[(fr >= lo) & (fr <= hi)].sum())
    return np.array(out)

def split_bands(x, f_lo, f_hi):
    """complementary raised-cosine split around the whole (looping) signal: low + high == x exactly"""
    X = np.fft.rfft(x, axis=0)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    t = np.clip((fr - f_lo) / (f_hi - f_lo), 0, 1)
    lowmask = 0.5 * (1 + np.cos(np.pi * t))          # 1 below f_lo, 0 above f_hi
    low = np.fft.irfft(X * lowmask[:, None], n=len(x), axis=0)
    return low, x - low

def encode(x, path, add=False):
    """OGG Vorbis q5 or AAC 160k (.m4a; the MP4 edit list hides the encoder's priming, so it decodes to the same length), by extension"""
    if os.path.exists(path):
        if add: return False
        sys.exit(f'{path} exists: not overwriting')
    codec = ['-c:a', 'aac', '-b:a', '160k'] if path.endswith('.m4a') else ['-c:a', 'libvorbis', '-q:a', '5']
    x = np.concatenate([x[-PAD:], x, x[:PAD]])   # the loop with its own end before it and its own start after it (see PAD)
    subprocess.run([FF, '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', *codec, path], input=x.astype(np.float32).tobytes(), check=True)
    return True

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('stems'); ap.add_argument('out'); ap.add_argument('--bpm', type=float, default=90); ap.add_argument('--bars', type=int, default=16)
    ap.add_argument('--demo', help='also write the story -> percussion -> boss listening demo here (mp3)')
    ap.add_argument('--m4a', action='store_true', help='also write AAC .m4a copies (Safari before 17)')
    ap.add_argument('--add', action='store_true', help='only write files that are missing; never overwrite')
    ap.add_argument('--conform', action='store_true', help='land a track up to 1%% off --bpm exactly on it (resampled)')
    ap.add_argument('--lufs', type=float, help='level the full mix to this loudness (LUFS), peak at most -1 dBFS')
    a = ap.parse_args()
    paths = {n: find(a.stems, n) for n in ('drums', 'bass', 'piano', 'other')}
    st = {n: load(p) for n, p in paths.items()}
    n = min(len(v) for v in st.values()); st = {k: v[:n] for k, v in st.items()}

    bpm, phase = lock_grid(st['drums'], a.bpm)
    speed = 1.0
    if a.conform and 0.02 <= abs(bpm - a.bpm) <= 0.01 * a.bpm:     # a hair off: resample every stem alike onto the asked tempo
        speed = int(round(SR * a.bpm / bpm)) / SR
        print(f'beat grid: {bpm:.2f} BPM, {a.bpm:g} asked: playing it {100 * (speed - 1):+.2f}% ({1200 * np.log2(speed):+.1f} cents) to land on {a.bpm:g}')
        st = {k: load(p, speed) for k, p in paths.items()}
        n = min(len(v) for v in st.values()); st = {k: v[:n] for k, v in st.items()}
        bpm, phase = lock_grid(st['drums'], a.bpm)
    beat = 60 / bpm
    print(f'beat grid: {bpm:.2f} BPM, first beat at {phase * 1000:.0f} ms')
    beats = np.arange(phase, n / SR - beat, beat)

    # beat 1 of the bar: the beat slot (of 4) the kick keeps landing on, when that's clear; otherwise the beat where the drums come in.
    # (Measured one beat at a time: a 4-beat window fires up to 2 beats before the drums actually enter.)
    rms = lambda x, t0, t1: float(np.sqrt(np.mean(x[int(t0 * SR):int(t1 * SR)] ** 2) + 1e-20))
    dr = np.array([rms(st['drums'], b, b + beat) for b in beats])
    entry = int(np.argmax(dr > 0.3 * dr.max()))
    kick = lowband_energy(st['drums'], beats)
    slot_kick = np.array([kick[i::4].sum() for i in range(4)])
    db_entry, db_kick = entry % 4, int(np.argmax(slot_kick))
    clear = slot_kick[db_kick] >= 2 * np.sort(slot_kick)[-2]
    down = db_kick if clear else db_entry
    print(f'drums come in on beat {entry} (slot {db_entry}); kick lands on slot {db_kick} '
          f'({"clear, " if clear else "not clear, "}{100 * slot_kick[db_kick] / slot_kick.sum():.0f}% of kick energy) -> beat 1 = slot {down}')

    bar = 4 * beat
    bar_starts = beats[down::4]
    names = ['drums', 'bass', 'piano', 'other']
    table = np.array([[rms(st[k], b, b + bar) for k in names] for b in bar_starts if b + bar <= n / SR])
    norm = table / table.max(axis=0)
    first_full = (entry - down) // 4                       # the bar where the drums come in
    best = None
    for k in range(first_full % 4, len(norm) - a.bars, 4):   # phrase-aligned starts (multiples of 4 bars from the drum entry)
        if bar_starts[k + a.bars] * SR + 0.05 * SR > n: break
        w = norm[k:k + a.bars]
        score = float(np.min(np.percentile(w, 10, axis=0)))
        if best is None or score > best[0]: best = (score, k)
    if not best: sys.exit('track too short for that many bars')
    k = best[1]
    print('per-bar level (each layer as % of its loudest bar):')
    print('  bar  ' + ' '.join(f'{x:>6s}' for x in names))
    for i, row in enumerate(norm):
        mark = ' <- loop' if k <= i < k + a.bars else ''
        print(f'  {i:3d}  ' + ' '.join(f'{100 * v:5.0f}%' for v in row) + mark)
    start = int(round(bar_starts[k] * SR))
    L = int(round(a.bars * 4 * 60 / a.bpm * SR)) if abs(bpm - a.bpm) < 0.02 else int(round(a.bars * bar * SR))
    print(f'loop: bars {k}..{k + a.bars - 1}, starts at {start / SR:.3f} s, {L} samples = {L / SR:.3f} s (min-layer score {best[0]:.2f})')

    X = int(0.020 * SR)                                     # seam crossfade
    fin = np.sin(np.linspace(0, np.pi / 2, X))[:, None]; fout = np.cos(np.linspace(0, np.pi / 2, X))[:, None]
    loops = {}
    for k2, v in st.items():
        seg = v[start:start + L].copy()
        seg[:X] = seg[:X] * fin + v[start + L:start + L + X] * fout
        loops[k2] = seg
    core, perc = split_bands(loops['drums'], 4000, 7000)
    synth, bells = split_bands(loops['other'], 1200, 2500)
    layers = {'drums_core': core, 'perc': perc, 'bass_808': loops['bass'], 'piano': loops['piano'], 'synth': synth, 'bells': bells}
    mix = sum(layers.values())
    level = None
    if a.lufs is not None:                                  # one gain for every layer: the full mix at --lufs, its peak at most -1 dBFS
        before, peak = lufs(mix), 20 * np.log10(np.abs(mix).max())
        g = min(a.lufs - before, -1.0 - peak)
        layers = {k: v * 10 ** (g / 20) for k, v in layers.items()}; mix = sum(layers.values())
        level = dict(target_lufs=a.lufs, was_lufs=round(before, 1), gain_db=round(g, 2), mix_lufs=round(lufs(mix), 1))
        print(f'level: full mix {before:.1f} LUFS, peak {peak:.1f} dB -> {g:+.1f} dB on every layer -> {level["mix_lufs"]} LUFS')
    info = dict(track=os.path.basename(os.path.normpath(a.stems)), bpm=round(bpm, 2), beats_per_bar=4, bars=a.bars, samples=L, sample_rate=SR,
                seconds=round(L / SR, 4), source_start_seconds=round(start / SR, 4), seam_crossfade_ms=20, pad_samples=PAD, layers=list(layers),
                splits={'drums': 'drums_core <4-7 kHz> perc', 'other': 'synth <1.2-2.5 kHz> bells'}, peak_dbfs_mix=round(20 * np.log10(np.abs(mix).max()), 2),
                states={'story': ['drums_core', 'piano', 'synth'], 'crowd': ['drums_core', 'perc', 'piano', 'synth'], 'boss': list(layers)})
    if speed != 1: info['conformed'] = dict(speed=round(speed, 6), cents=round(1200 * np.log2(speed), 2))
    if level: info['level'] = level
    jp = os.path.join(a.out, 'loop.json')
    if a.add and os.path.exists(jp):   # adding to a folder: only if it holds this exact cut, so files from two cuts never mix
        old = json.load(open(jp, encoding='utf-8'))
        if old.get('samples') != L or old.get('source_start_seconds') != info['source_start_seconds'] or old.get('pad_samples', 0) != PAD:
            sys.exit(f'{jp} is from a different cut ({old.get("samples")} samples at {old.get("source_start_seconds")} s): not mixing files from two cuts')
    os.makedirs(a.out, exist_ok=True)
    wrote = []
    for ext in ['ogg'] + (['m4a'] if a.m4a else []):
        for name, x in list(layers.items()) + [('mix_all', mix)]:
            if encode(x, os.path.join(a.out, f'{name}.{ext}'), a.add): wrote.append(f'{name}.{ext}')
    if not os.path.exists(jp):
        with open(jp, 'x', encoding='utf-8') as f: json.dump(info, f, indent=2)
        wrote.append('loop.json')
    print(f'wrote {", ".join(wrote) or "nothing (all there)"} to {a.out} (mix peak {info["peak_dbfs_mix"]} dB)')

    if a.demo:   # story -> + percussion -> boss, each one loop long, layers fading over one beat at each change
        F = int(round(beat * SR)); total = 3 * L
        out = np.zeros((total, 2))
        gains = {'story': info['states']['story'], 'crowd': info['states']['crowd'], 'boss': info['states']['boss']}
        order = ['story', 'crowd', 'boss']
        for name, x in layers.items():
            g = np.zeros(total)
            for i, s in enumerate(order): g[i * L:(i + 1) * L] = 1.0 if name in gains[s] else 0.0
            for i in (1, 2):                                   # one-beat fades at each change
                a0 = i * L
                if g[a0 - 1] != g[a0]: g[a0:a0 + F] = np.linspace(g[a0 - 1], g[a0], F)
            out += np.tile(x, (3, 1)) * g[:, None]
        os.makedirs(os.path.dirname(os.path.abspath(a.demo)), exist_ok=True)
        if os.path.exists(a.demo): sys.exit(f'{a.demo} exists: not overwriting')
        subprocess.run([FF, '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-b:a', '192k', a.demo], input=out.astype(np.float32).tobytes(), check=True)
        print(f'demo: {a.demo} ({total / SR:.1f} s: story, then + percussion at {L / SR:.1f} s, then boss at {2 * L / SR:.1f} s)')

if __name__ == '__main__':
    main()
