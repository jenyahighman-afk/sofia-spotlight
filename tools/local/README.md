# Local-only tools (family computer)

These read the family's videos, music and typed lyrics from `media/` (git-ignored) and never upload anything. The only
things that go into the repo from them are numbers (`lyricSnaps`, `lyricKeys`) and cue labels. Python 3.12 with
faster-whisper, PyAV, numpy and Pillow; no ffmpeg needed (PyAV decodes).

| Script | What it does |
|---|---|
| `lyric_times.py <audio or video> <out.json>` | Decodes the audio (PyAV → 16 kHz), runs faster-whisper `medium.en` with word times. Used on the final solo track (`media/solo-track-words.json`). |
| `align_lyrics.py <lyrics.txt> <words.json> <out.json> <report.md>` | Aligns the family's typed lines (the truth) to the heard words: which lines the cut sings and when each starts. Writes `lyricKeys` (FNV-1a of each line → starts) for `data/dances.json` and a report with the lyrics (local). |
| `extract_candidates.py <repo root>` | For every solo cue, cuts the sharpest frame near six moments of Hannah's run-through and four of her walkthrough (1080p originals), estimates where the dancer is, and writes `media/cue-review/` — `index.html` is the approval sheet (pick one still per cue, slide the crop, fix labels, Download choices). |
| `apply_choices.py <repo root> <cue-choices.json> [--install]` | Cuts the chosen frames at 720×900 into `media/cue-pack-v2/cue-photos/` with `cues.json`; `--install` backs up the old pack, copies the new one over `media/cue-pack/cue-photos/` and runs `node tools/import-cues.cjs` (labels and photo times into `data/dances.json`). Then import the photos on the phone: Cue check ▸ Import cue pack. |

Hand-run only; nothing in `npm test` or the Pages workflow touches them.
