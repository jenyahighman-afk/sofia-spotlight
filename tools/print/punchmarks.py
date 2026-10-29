"""Punch marks for media/binder-print/Sofia-Practice-Toolkit.pdf, in place: the printing session's
punchmarks.py (scratchpad 87d5f99c…/scripts) restricted to the Toolkit. US 3-ring: hole centres 0.5 in from
the left edge at 1.25 / 5.5 / 9.75 in from the top, 9/32 in diameter: grey circle, black centre dot, four
short sighting ticks. Print at Actual size (100 %)."""
import os, sys
import fitz
sys.stdout.reconfigure(encoding="utf-8")
path = sys.argv[1]; out = sys.argv[2]
X = 0.5 * 72
YS = [1.25 * 72, 5.5 * 72, 9.75 * 72]
R = (9 / 32 / 2) * 72
GREY = (0.45, 0.45, 0.45)
doc = fitz.open(path)
for page in doc:
    assert page.rotation == 0 and abs(page.rect.width - 612) < 1 and abs(page.rect.height - 792) < 1, (page.number, page.rect)
    sh = page.new_shape()
    for y in YS:
        sh.draw_circle(fitz.Point(X, y), R)
        sh.finish(color=GREY, width=0.6)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh.draw_line(fitz.Point(X + dx * (R + 1.5), y + dy * (R + 1.5)), fitz.Point(X + dx * (R + 6), y + dy * (R + 6)))
        sh.finish(color=GREY, width=0.6)
        sh.draw_circle(fitz.Point(X, y), 1.2)
        sh.finish(color=(0, 0, 0), fill=(0, 0, 0), width=0)
    sh.commit()
tmp = path + ".tmp"
doc.save(tmp, garbage=3, deflate=True); n = len(doc); doc.close()
os.replace(tmp, path)
d = fitz.open(path)
print(f"{os.path.basename(path)}: {len(d)} pages, {os.path.getsize(path):,} bytes, drawings on p2: {len(d[1].get_drawings())}")
# left strip of page 2 at 150 dpi, and a montage of all pages at 28 dpi
d[1].get_pixmap(dpi=150, clip=fitz.Rect(0, 0, 1.6 * 72, 792)).save(os.path.join(out, "punch-p2-strip.png"))
tiles = [p.get_pixmap(dpi=28) for p in d]
w = tiles[0].width; h = tiles[0].height; cols = 4; rows = (len(tiles) + cols - 1) // cols
mont = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, cols * (w + 8), rows * (h + 8)), False); mont.clear_with(200)
for i, t in enumerate(tiles):
    t = fitz.Pixmap(fitz.csRGB, t) if t.colorspace.n != 3 else t
    t.set_origin((i % cols) * (w + 8) + 4, (i // cols) * (h + 8) + 4); mont.copy(t, t.irect)
mont.save(os.path.join(out, "montage.png")); print("renders saved")
