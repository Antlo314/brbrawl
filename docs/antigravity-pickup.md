# Antigravity: Gemini art beside ComfyUI

Written 2026-10-31. Google AI Pro gives Antigravity (Google's coding agent) image generation with Nano Banana, Google's image model,
on the plan's own quota, with no per-image cost. It runs in Google's cloud, not on the GPU, so it can work while ComfyUI is busy.
ComfyUI stays the main pipeline. Antigravity is a second one, and Gemini is good at faces.

## 1. Sign up (from your phone is fine)

- Enroll in a Google Career Certificate on Coursera: https://www.coursera.org/google-career-certificates
  Enrolling unlocks 3 months of Google AI Pro. Redeem it by December 31, 2026.
- There are two trials, each with a card on file:
  - **Coursera's 7-day trial:** cancel it before day 7 unless you want to keep paying for the course.
  - **AI Pro's 3 months:** it renews at $19.99 a month after that, so cancel before then if you don't want it.
  Before you cancel Coursera, check in your Google account that the AI Pro months stay.

## 2. Install (on the PC, once ComfyUI is done for the day)

- Download Antigravity only from https://antigravity.google/download (Windows). There's no phone version: the Play Store app is for
  Googlebook laptops.
- Sign in with the Google account that has AI Pro. **Don't add a Gemini API key**, or images get billed.
- File → Open Folder → `MM Game\originals\antigravity`. Open only this folder, not the whole game.

## 3. Start it

Paste this into Antigravity's agent:

```
Read AGENTS.md, then do the first job in jobs/QUEUE.md and show me result.png before you do the rest.
```

If the first frame looks right (same pose, the right face), tell it to keep going through the queue.

## 4. Bring the results in (Claude)

```
python -I tools/artpipe/antigravity_jobs.py status
python -I tools/artpipe/antigravity_jobs.py compare     # originals/antigravity/compare/all.jpg: source | ComfyUI | Antigravity
python -I tools/artpipe/antigravity_jobs.py use <job> ...   # the picked ones become the fix cells (ComfyUI's kept in fix/comfy/)
python -I tools/artpipe/hw_cut.py <creature> ...
```

New jobs: `python -I tools/artpipe/antigravity_jobs.py export <look> <page> <cells...> [--pose <name>]`, the same arguments as
comfy_fixcell.py.

The first batch (exported 2026-10-31) is the 23 fall and jump cells ComfyUI is also redrawing, so the two can be compared frame for frame:
- Wolf's fall, 1 to 8
- Jack's fall 1, 2 and 7, and his jump 5 and 7
- the Count's jump 4 and 7
- Millzy's fall 1 to 6, and his jump 3 and 4
