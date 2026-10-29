# Local-only: align the family's typed lyrics (the truth) to the words faster-whisper heard on the final track (timing),
# one monotonic word alignment with cheap whole-line skips (the 2:04 cut drops parts of the song). Writes:
#   out_json  — per sung line: her line index, start time, coverage, flagged words; plus lyricKeys {fnv1a(line): [starts]}
#   out_md    — a human report WITH the lyrics (stays in media/, git-ignored)
# Nothing here is uploaded; the only thing that goes into the repo is the keys→times map (no words).
import json, re, sys, difflib
lyr_path, wh_path, out_json, out_md = sys.argv[1:5]

def norm(s):
    s = s.lower().replace("’", "'").replace("'", "")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()
def fnv(s):
    h = 0x811c9dc5
    for b in s.encode():
        h ^= b; h = (h * 0x01000193) & 0xffffffff
    return format(h, "08x")

lines = [l.rstrip("\r\n") for l in open(lyr_path, encoding="utf-8-sig")]
lines = [l for l in lines if l.strip()]
L = [norm(l).split() for l in lines]
H = [(li, wi, w) for li, ws in enumerate(L) for wi, w in enumerate(ws)]   # her words, flat
line_start = {}; pos = 0
for li, ws in enumerate(L): line_start[pos] = (li, len(ws)); pos += len(ws)
N = len(H)
wh = json.load(open(wh_path, encoding="utf-8"))
T = [(norm(w["w"]), w["s"], w["e"], w["p"]) for seg in wh["lines"] for w in seg["words"] if norm(w["w"])]
M = len(T)

MATCH, FUZZY, SUB, GAP_H, GAP_T, LINE_SKIP = 3.0, 1.5, -1.5, -1.0, -1.0, -0.8
def sim(a, b):
    if a == b: return MATCH
    r = difflib.SequenceMatcher(None, a, b).ratio()
    return FUZZY if r >= 0.75 else SUB

NEG = float("-inf")
S = [[NEG] * (M + 1) for _ in range(N + 1)]
B = [[None] * (M + 1) for _ in range(N + 1)]
S[0][0] = 0.0
for i in range(N + 1):
    for j in range(M + 1):
        s = S[i][j]
        if s == NEG: continue
        if i < N and j < M:
            v = s + sim(H[i][2], T[j][0])
            if v > S[i + 1][j + 1]: S[i + 1][j + 1] = v; B[i + 1][j + 1] = ("m", i, j)
        if i < N:
            v = s + GAP_H
            if v > S[i + 1][j]: S[i + 1][j] = v; B[i + 1][j] = ("h", i, j)
        if j < M:
            v = s + GAP_T
            if v > S[i][j + 1]: S[i][j + 1] = v; B[i][j + 1] = ("t", i, j)
        if i in line_start:
            li, n = line_start[i]; v = s + LINE_SKIP
            if v > S[i + n][j]: S[i + n][j] = v; B[i + n][j] = ("L", i, j)
# backtrace
i, j = N, M; pairs = []
while (i, j) != (0, 0):
    kind, pi, pj = B[i][j]
    if kind == "m": pairs.append((pi, pj))
    i, j = pi, pj
pairs.reverse()
aligned = {}  # her word index -> transcript word index
for a, b in pairs: aligned[a] = b

report = []; keys = {}; occ = []
prev_end = 0.0
for li, ws in enumerate(L):
    idx = [k for k, (l2, _, _) in enumerate(H) if l2 == li]
    got = [(H[k][1], T[aligned[k]]) for k in idx if k in aligned]
    cov = len(got) / max(1, len(ws))
    if not got or cov < 0.5:
        report.append({"line": li, "sung": False, "cov": round(cov, 2), "text": lines[li]})
        continue
    wi0, (w0, s0, e0, p0) = got[0]
    start = max(prev_end, round(s0 - 0.3 * wi0, 2))
    end = max(t[2] for _, t in got)
    prev_end = end
    flags = []
    for k in idx:
        her = H[k][2]
        if k in aligned:
            heard, s_, e_, p = T[aligned[k]]
            if heard != her and p >= 0.6: flags.append({"her": her, "heard": heard, "p": p, "t": s_})
        else:
            flags.append({"her": her, "heard": None, "p": None, "t": None})
    key = fnv(norm(lines[li]))
    keys.setdefault(key, []).append(round(start, 2))
    occ.append({"line": li, "t": round(start, 2), "end": round(end, 2), "cov": round(cov, 2), "key": key, "flags": flags})
    report.append({"line": li, "sung": True, "t": round(start, 2), "end": round(end, 2), "cov": round(cov, 2), "text": lines[li], "flags": flags})
for k in keys: keys[k].sort()

json.dump({"source": wh.get("source"), "lines": len(lines), "sung": len(occ), "occurrences": occ, "lyricKeys": keys,
           "notSung": [r["line"] for r in report if not r["sung"]]}, open(out_json, "w", encoding="utf-8"), indent=1)
with open(out_md, "w", encoding="utf-8") as f:
    f.write(f"# Solo lyrics vs the final track\n\nTyped lines: {len(lines)} · sung in the cut: {len(occ)} · not in the cut: {len(lines) - len(occ)}\n\n")
    f.write("| # | start | end | cov | line | check |\n|---|---|---|---|---|---|\n")
    for r in report:
        if r["sung"]:
            fl = "; ".join((f"**{x['her']}** heard as *{x['heard']}* ({x['p']:.2f})" if x["heard"] else f"**{x['her']}** not heard") for x in r["flags"])
            f.write(f"| {r['line']+1} | {r['t']:.2f} | {r['end']:.2f} | {int(r['cov']*100)}% | {r['text']} | {fl} |\n")
        else:
            f.write(f"| {r['line']+1} | — | — | {int(r['cov']*100)}% | {r['text']} | not in the cut |\n")
sung_heard = sum(len(T) for _ in [0])
print(f"typed lines {len(lines)}, heard words {M}, sung lines {len(occ)}, not sung {len(lines)-len(occ)}, keys {len(keys)}, flagged words {sum(len(o['flags']) for o in occ)}")
