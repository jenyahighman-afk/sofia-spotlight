# Local-only: time the sung lines of the solo from Hannah's run-through video (never uploaded; output is git-ignored).
import json, sys, time, os
import numpy as np, av
from faster_whisper import WhisperModel
src = sys.argv[1]; out = sys.argv[2]; npy = os.path.splitext(out)[0] + "-16k.npy"
t0 = time.time()
if os.path.exists(npy):
    audio = np.load(npy)
else:
    c = av.open(src); st = c.streams.audio[0]
    rs = av.AudioResampler(format="s16", layout="mono", rate=16000); chunks = []
    for fr in c.decode(st):
        for f in rs.resample(fr): chunks.append(f.to_ndarray().reshape(-1))
    for f in rs.resample(None): chunks.append(f.to_ndarray().reshape(-1))
    audio = (np.concatenate(chunks).astype(np.float32) / 32768.0); np.save(npy, audio)
print(f"audio {len(audio)/16000:.1f}s decoded in {time.time()-t0:.0f}s", flush=True)
m = WhisperModel("medium.en", device="cpu", compute_type="int8")
segs, info = m.transcribe(audio, word_timestamps=True, vad_filter=False, beam_size=5, condition_on_previous_text=False, no_speech_threshold=1.0, temperature=0, log_prob_threshold=None, initial_prompt="A pop ballad with sung lyrics.")
lines = []
for s in segs:
    words = [{"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2), "p": round(w.probability, 2)} for w in (s.words or [])]
    lines.append({"s": round(s.start, 2), "e": round(s.end, 2), "text": s.text.strip(), "words": words})
json.dump({"source": src, "model": "medium.en", "duration": info.duration, "lines": lines}, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
nw = sum(len(l["words"]) for l in lines)
print(f"done in {time.time()-t0:.0f}s: duration {info.duration:.1f}s, {len(lines)} lines, {nw} words, first line at {lines[0]['s'] if lines else None}s, last line ends {lines[-1]['e'] if lines else None}s")
