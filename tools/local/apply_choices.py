# Local-only. Turns the approval sheet's cue-choices.json into a new cue pack: media/cue-pack-v2/cue-photos/ with one
# 720×900 JPEG per cue (the chosen frame cut from the 1080p original at the chosen crop, or the current photo copied)
# and cues.json (labels and photo_time updated). With --install it backs up media/cue-pack/cue-photos/ to
# media/cue-pack/cue-photos.v1/, copies the new pack over it and runs node tools/import-cues.cjs (labels into data/).
#   python apply_choices.py <repo root> <cue-choices.json> [--install]
import json, os, sys, shutil, subprocess
import av
from PIL import Image

ROOT, CHOICES = sys.argv[1], sys.argv[2]; INSTALL = "--install" in sys.argv
M = lambda *p: os.path.join(ROOT, "media", *p)
REV = M("cue-review"); V2 = M("cue-pack-v2", "cue-photos"); os.makedirs(V2, exist_ok=True)
OFFSET = 4.98; W, H = 720, 900
cand = {x["id"]: x for c in json.load(open(os.path.join(REV, "candidates.json"), encoding="utf-8"))["cues"] for x in c["cands"]}
choices = json.load(open(CHOICES, encoding="utf-8"))["choices"]
pack = json.load(open(M("cue-pack", "cue-photos", "cues.json"), encoding="utf-8"))
VID = {"run": M("hannah-runthrough.MOV"), "walk": M("hannah-walkthrough.MOV")}

def frame_at(path, t):
    c = av.open(path); v = c.streams.video[0]
    c.seek(int(max(0, t - 0.6) / v.time_base), stream=v, backward=True, any_frame=False)
    best = None
    for fr in c.decode(v):
        ft = float(fr.pts * v.time_base)
        if ft >= t - 0.017: best = fr; break
        best = fr
    im = best.to_image(); c.close(); return im

def cut(im, x_pct):
    w, h = im.size; cw = int(round(h * W / H)); cx = int(round(w * x_pct / 100)); left = max(0, min(w - cw, cx - cw // 2))
    return im.crop((left, 0, left + cw, h)).resize((W, H), Image.LANCZOS)

changed = 0
for c in pack:
    n = c["n"]; ch = choices.get(str(n)) or choices.get(n) or {}
    label = (ch.get("label") or "").strip()
    if label and label != c["label"]: print(f"  {n:02d} label: {c['label']!r} → {label!r}"); c["label"] = label
    pick = ch.get("choice", "current"); dst = os.path.join(V2, c["photo"])
    if pick == "current" or pick not in cand:
        shutil.copyfile(M("cue-pack", "cue-photos", c["photo"]), dst); continue
    x = cand[pick]; im = cut(frame_at(VID[x["src"]], x["t"]), ch.get("x") if ch.get("x") is not None else x["x"])
    im.save(dst, "JPEG", quality=90); changed += 1
    if x["src"] == "run": c["photo_time"] = round(x["t"] - OFFSET, 2)
    print(f"  {n:02d} ← {pick} ({x['src']} {x['t']:.2f}s, crop {ch.get('x', x['x'])}%)")
json.dump(pack, open(os.path.join(V2, "cues.json"), "w", encoding="utf-8"), indent=1)
shutil.copyfile(M("cue-pack", "cue-photos", "walkthrough-map.json"), os.path.join(V2, "walkthrough-map.json"))
print(f"new pack: {changed} new photos, {len(pack) - changed} kept → {V2}")
if INSTALL:
    bak = M("cue-pack", "cue-photos.v1")
    if not os.path.exists(bak): shutil.copytree(M("cue-pack", "cue-photos"), bak); print("backup →", bak)
    for f in os.listdir(V2): shutil.copyfile(os.path.join(V2, f), M("cue-pack", "cue-photos", f))
    print(subprocess.run(["node", os.path.join(ROOT, "tools", "import-cues.cjs")], capture_output=True, text=True, cwd=ROOT).stdout.strip())
    print("installed: media/cue-pack/cue-photos is the new pack; data/dances.json has the labels. Import the photos on the phone: Cue check ▸ Import cue pack.")
