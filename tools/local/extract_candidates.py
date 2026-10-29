# Local-only. For every solo cue, cut candidate stills from Hannah's run-through and walkthrough (the 1080p originals),
# keep the sharpest frame near each candidate moment, estimate where the dancer is in the frame, and write
# media/cue-review/ (thumbs/, candidates.json, index.html = the approval sheet). Nothing leaves this computer.
#   python extract_candidates.py <repo root>
import json, os, sys, math, html
import numpy as np, av
from PIL import Image

ROOT = sys.argv[1]
M = lambda *p: os.path.join(ROOT, "media", *p)
OUT = M("cue-review"); TH = os.path.join(OUT, "thumbs"); os.makedirs(TH, exist_ok=True)
RUN, WALK = M("hannah-runthrough.MOV"), M("hannah-walkthrough.MOV")
OFFSET = 4.98  # the music starts 4.98 s into the run-through video
RUN_K, WALK_K = 6, 4

dances = json.load(open(os.path.join(ROOT, "data", "dances.json"), encoding="utf-8"))
solo = next(d for d in dances if d["id"] == "solo"); cues = sorted(solo["cues"], key=lambda c: c["t"])
_wm = json.load(open(M("cue-pack", "cue-photos", "walkthrough-map.json")))
_wl = _wm if isinstance(_wm, list) else next(v for v in _wm.values() if isinstance(v, list))
import re as _re
wmap = {}  # cue n -> [(start, end), ...] walkthrough windows; entries name a cue, a range "10-12", "stopped, then 11", or a pause
for e in _wl:
    if not (isinstance(e, list) and len(e) >= 3): continue
    a, b, who = float(e[0]), float(e[1]), e[2]; ns = []
    if isinstance(who, (int, float)): ns = [int(who)]
    elif isinstance(who, str):
        for m in _re.finditer(r"(\d+)\s*-\s*(\d+)", who): ns += list(range(int(m.group(1)), int(m.group(2)) + 1))
        m = _re.search(r"then\s+(\d+)", who)
        if m: ns.append(int(m.group(1)))
        if not ns and not _re.search(r"stopped|talking", who):
            m = _re.match(r"\s*(\d+)", who); ns = [int(m.group(1))] if m else []
    for n in ns: wmap.setdefault(n, []).append((a, b))
tr = json.load(open(M("hannah-walkthrough-transcript.json"), encoding="utf-8"))
twords = [(w["s"], w["e"], w["w"].strip()) for s in tr["segments"] for w in (s.get("words") or [])]
al = json.load(open(M("solo-lyric-align.json"), encoding="utf-8"))
lyr = [l.rstrip("\r\n") for l in open(M("Stay a little longer_Lyrics.txt"), encoding="utf-8-sig")]; lyr = [l for l in lyr if l.strip()]

def spaced(a, b, k):
    if b - a < 0.6: k = min(k, 2)
    if k == 1: return [(a + b) / 2]
    return [a + (b - a) * i / (k - 1) for i in range(k)]

wants = {"run": [], "walk": []}
for c in cues:
    n = c["n"]; t, end = c["t"], c["end"]; pt = c.get("pt", t)
    times = [pt] + spaced(t + 0.15, end - 0.15, RUN_K)
    for k, mt in enumerate(times): wants["run"].append({"id": f"{n:02d}-r{k}", "n": n, "t": mt + OFFSET, "music": mt, "src": "run", "k": k})
    if n in wmap:
        wins = wmap[n]; total = sum(b - a for a, b in wins); wts = []
        for a, b in wins: wts += spaced(a + 0.25, b - 0.25, max(1, round(WALK_K * (b - a) / total)))
        for k, wt in enumerate(wts, 1): wants["walk"].append({"id": f"{n:02d}-w{k}", "n": n, "t": wt, "music": None, "src": "walk", "k": k})

def sharpness(g):
    g = g.astype(np.float32)
    lap = 4 * g - np.roll(g, 1, 0) - np.roll(g, -1, 0) - np.roll(g, 1, 1) - np.roll(g, -1, 1)
    return float(lap[2:-2, 2:-2].var())

def pass_video(path, ws, tag):
    c = av.open(path); v = c.streams.video[0]; v.thread_type = "AUTO"
    best = {w["id"]: None for w in ws}; bg_samples = []; nframe = 0
    ws_sorted = sorted(ws, key=lambda w: w["t"])
    for frame in c.decode(v):
        t = float(frame.pts * v.time_base) if frame.pts is not None else nframe / float(v.average_rate); nframe += 1
        near = [w for w in ws_sorted if abs(w["t"] - t) <= 0.085]
        if nframe % 60 == 0 or near:
            g = frame.to_ndarray(format="gray")[::4, ::4]
            if nframe % 60 == 0: bg_samples.append(g)
        for w in near:
            s = sharpness(g); b = best[w["id"]]
            if b is None or s > b["sharp"]:
                im = frame.to_image().resize((640, 360), Image.LANCZOS)
                best[w["id"]] = {"sharp": s, "t": round(t, 3), "img": im, "g": g}
    c.close()
    bg = np.median(np.stack(bg_samples), axis=0).astype(np.float32)
    out = {}
    for w in ws:
        b = best[w["id"]]
        if b is None: continue
        d = np.abs(b["g"].astype(np.float32) - bg) > 28
        col = d.sum(axis=0).astype(np.float64); tot = col.sum()
        if tot > 50:
            xs = np.arange(col.size); x = float((col * xs).sum() / tot) / col.size
            cum = np.cumsum(col) / tot; lo = float(np.searchsorted(cum, 0.1)) / col.size; hi = float(np.searchsorted(cum, 0.9)) / col.size
        else: x, lo, hi = 0.5, 0.3, 0.7
        name = f"{w['id']}.jpg"; b["img"].save(os.path.join(TH, name), "JPEG", quality=82)
        out[w["id"]] = {**{k: w[k] for k in ("id", "n", "src", "k", "music")}, "t": b["t"], "sharp": round(b["sharp"], 1), "x": round(x * 100, 1), "span": [round(lo * 100, 1), round(hi * 100, 1)], "thumb": "thumbs/" + name}
        print(f"  {w['id']} t={b['t']:.2f} sharp={b['sharp']:.0f} x={x*100:.0f}%", flush=True)
    return out

print("run-through pass…", flush=True); cand = pass_video(RUN, wants["run"], "run")
print("walkthrough pass…", flush=True); cand.update(pass_video(WALK, wants["walk"], "walk"))

# current pack photos as thumbs
for c in cues:
    src = M("cue-pack", "cue-photos", c["photo"])
    if os.path.exists(src):
        Image.open(src).convert("RGB").save(os.path.join(TH, f"{c['n']:02d}-cur.jpg"), "JPEG", quality=85)

sheet = []
for c in cues:
    n = c["n"]; t, end = c["t"], c["end"]
    says = ""
    says = " ".join(w for s, e, w in twords if any(s >= a - 0.3 and s <= b + 0.3 for a, b in wmap.get(n, [])))
    lines = [lyr[o["line"]] for o in al["occurrences"] if o["t"] < end and o["end"] > t]
    cs = sorted([x for x in cand.values() if x["n"] == n], key=lambda x: (x["src"] != "run", x["k"]))
    ranks = sorted([x for x in cs], key=lambda x: -x["sharp"]); rank = {x["id"]: i + 1 for i, x in enumerate(ranks)}
    for x in cs: x["rank"] = rank[x["id"]]
    sheet.append({"n": n, "label": c["move"], "trick": bool(c.get("trick")), "t": t, "end": end, "pt": c.get("pt"), "photo": c["photo"], "hannahWord": c.get("hannahWord", ""),
                  "walk": [list(w) for w in wmap.get(n, [])], "hannahSays": says, "lyrics": lines, "cur": f"thumbs/{n:02d}-cur.jpg" if os.path.exists(os.path.join(TH, f"{n:02d}-cur.jpg")) else "", "cands": cs})
json.dump({"offset": OFFSET, "cues": sheet}, open(os.path.join(OUT, "candidates.json"), "w", encoding="utf-8"), indent=1)

def fmt(s): m = int(s // 60); return f"{m}:{s - m*60:05.2f}"
E = html.escape
parts = []
for c in sheet:
    cands_html = []
    cands_html.append(f'''<figure class="cand cur"><label><input type="radio" name="c{c['n']}" value="current" checked> keep the current photo</label>
      <div class="box">{f'<img src="{c["cur"]}" style="object-fit:contain">' if c['cur'] else '<div class="none">no photo yet</div>'}</div><figcaption>as it is in the app now</figcaption></figure>''')
    for x in c["cands"]:
        src = "run-through" if x["src"] == "run" else "walkthrough"
        when = f"{fmt(x['music'])} on the track" if x["music"] is not None else f"{fmt(x['t'])} in the walkthrough"
        tag = " · the photo's own moment" if (x["src"] == "run" and x["k"] == 0) else ""
        cands_html.append(f'''<figure class="cand" data-id="{x['id']}"><label><input type="radio" name="c{c['n']}" value="{x['id']}"> {src}{tag}</label>
      <div class="box"><img src="{x['thumb']}" data-x="{x['x']}" style="object-position:{x['x']}% 50%"></div>
      <input type="range" class="xs" min="0" max="100" value="{x['x']}" title="where to crop (left ↔ right)">
      <figcaption>{when} · sharpness #{x['rank']}</figcaption></figure>''')
    lyr_html = "".join(f"<div class='lyr'>🎵 {E(l)}</div>" for l in c["lyrics"]) or "<div class='lyr muted'>no sung line here</div>"
    parts.append(f'''<section class="cue{' trick' if c['trick'] else ''}" id="cue{c['n']}">
  <h2>{c['n']:02d} {'★ ' if c['trick'] else ''}<input class="label" value="{E(c['label'])}" data-n="{c['n']}"></h2>
  <div class="meta">track {fmt(c['t'])} – {fmt(c['end'])}{(' · Hannah’s cue word: <b>' + E(c['hannahWord']) + '</b>') if c['hannahWord'] else ''}{(' · walkthrough ' + ', '.join(fmt(a) + ' – ' + fmt(b) for a, b in c['walk'])) if c['walk'] else ''}</div>
  {lyr_html}
  <div class="says">🗣 {E(c['hannahSays']) if c['hannahSays'] else '<span class="muted">(nothing transcribed in this window)</span>'}</div>
  <div class="cands">{''.join(cands_html)}</div>
</section>''')

page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Solo cue photos — approval sheet</title>
<style>
body{{font:15px/1.4 system-ui,Segoe UI,sans-serif;margin:0;padding:16px 20px 80px;background:#faf7f9;color:#2b1a26}}
h1{{font-size:22px;margin:0 0 6px}} .intro{{max-width:900px;color:#5a4a55;margin-bottom:14px}}
.cue{{background:#fff;border:1px solid #eadfe6;border-radius:14px;padding:12px 14px;margin:14px 0}} .cue.trick{{border-color:#ff5c93;border-width:2px}}
h2{{font-size:17px;margin:0 0 4px;display:flex;align-items:center;gap:8px}} h2 input.label{{flex:1;font:inherit;font-weight:600;padding:4px 8px;border:1px solid #d9cbd3;border-radius:8px}}
.meta{{color:#5a4a55;font-size:13px;margin-bottom:4px}} .lyr{{font-style:italic;color:#7a2d55}} .says{{font-size:13px;color:#2b1a26;background:#fff3f8;border-radius:8px;padding:6px 8px;margin:6px 0 8px}} .muted{{color:#9a8a95}}
.cands{{display:flex;flex-wrap:wrap;gap:10px}} .cand{{margin:0;width:176px;font-size:12px}} .cand label{{display:block;margin-bottom:4px;cursor:pointer}}
.box{{width:176px;height:220px;background:#eee;border-radius:8px;overflow:hidden;border:2px solid transparent}} .cand input:checked ~ .box, .cand:has(input:checked) .box{{border-color:#ff5c93}}
.box img{{width:100%;height:100%;object-fit:cover;display:block}} body.full .box{{height:99px}} body.full .box img{{object-fit:contain;object-position:center}}
.none{{height:100%;display:grid;place-items:center;color:#9a8a95}} .xs{{width:176px;margin:4px 0 0}} figcaption{{color:#5a4a55}}
.bar{{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #eadfe6;padding:10px 20px;display:flex;gap:12px;align-items:center}}
button{{font:inherit;padding:8px 14px;border-radius:10px;border:0;background:#ff5c93;color:#fff;cursor:pointer}} button.ghost{{background:#eee;color:#2b1a26}}
</style></head><body>
<h1>Solo cue photos — pick the still for each move</h1>
<div class="intro">For every cue: the photo in the app now, six moments from Hannah’s run-through (the first is the photo’s own moment) and four from her walkthrough. Each is shown already cropped to the card’s shape — drag the slider under a picture to move the crop left or right. Pick one per cue, fix the label if you like, then <b>Download choices</b> and send me the file. Sharpness #1 is the crispest of that cue’s candidates. Hannah’s words come from the walkthrough transcript; the sung line is yours.</div>
<label><input type="checkbox" id="full"> show the whole frame instead of the crop</label>
{''.join(parts)}
<div class="bar"><button id="dl">⬇ Download choices</button><button class="ghost" id="reset">Reset all to current</button><span id="count"></span></div>
<script>
const Q=(s,r=document)=>[...r.querySelectorAll(s)];
Q('.xs').forEach(r=>r.addEventListener('input',()=>{{const img=r.closest('.cand').querySelector('img'); img.style.objectPosition=r.value+'% 50%';}}));
document.getElementById('full').onchange=e=>document.body.classList.toggle('full',e.target.checked);
function choices(){{const out={{}}; Q('section.cue').forEach(s=>{{const n=+s.id.slice(3); const sel=Q('input[type=radio]:checked',s)[0]; const cand=sel&&sel.value!=='current'?sel.closest('.cand'):null; out[n]={{choice:sel?sel.value:'current', x:cand?+cand.querySelector('.xs').value:null, label:s.querySelector('.label').value.trim()}};}}); return out;}}
function count(){{const c=choices(); const n=Object.values(c).filter(x=>x.choice!=='current').length; document.getElementById('count').textContent=n+' of '+Object.keys(c).length+' cues get a new photo';}}
document.addEventListener('change',count); document.addEventListener('input',count); count();
document.getElementById('dl').onclick=()=>{{const blob=new Blob([JSON.stringify({{made:new Date().toISOString(),choices:choices()}},null,1)],{{type:'application/json'}}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='cue-choices.json'; a.click();}};
document.getElementById('reset').onclick=()=>{{Q('input[type=radio][value=current]').forEach(r=>r.checked=true); count();}};
</script></body></html>'''
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(page)
print(f"done: {len(cand)} candidates for {len(sheet)} cues → {os.path.join(OUT, 'index.html')}")
