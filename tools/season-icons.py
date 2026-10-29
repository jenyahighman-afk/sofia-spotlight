"""Rasterizes icons/season/<id>.svg to <id>-180.png (the iPhone home-screen button size) with PyMuPDF.
   python -I tools/season-icons.py [--sheet <out.png>]   (--sheet also writes a contact sheet of all of them)"""
import os, sys
import fitz

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DIR = os.path.join(ROOT, "icons", "season")
ids = sorted(f[:-4] for f in os.listdir(DIR) if f.endswith(".svg"))
# The iPhone paints transparent pixels of a home-screen button black, so the PNG is opaque: the theme's background
# colour (the first circle's fill) fills the whole square and the round design sits on it.
import re
from PIL import Image
for i in ids:
    src = open(os.path.join(DIR, i + ".svg"), encoding="utf-8").read()
    bg = re.search(r'<circle cx="256" cy="256" r="248" fill="(#[0-9A-Fa-f]{6})"', src).group(1)
    doc = fitz.open(os.path.join(DIR, i + ".svg"))
    page = doc[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(180 / page.rect.width, 180 / page.rect.height), alpha=True)
    art = Image.frombytes("RGBA", (pix.width, pix.height), pix.samples)
    out = Image.new("RGB", art.size, bg); out.paste(art, (0, 0), art)
    out.save(os.path.join(DIR, i + "-180.png"))
print("icons/season: %d buttons at 180 px" % len(ids))

if "--sheet" in sys.argv:
    out = sys.argv[sys.argv.index("--sheet") + 1]
    cols, size, pad = 4, 180, 20
    rows = (len(ids) + cols - 1) // cols
    sheet = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, cols * (size + pad) + pad, rows * (size + pad) + pad), False)
    sheet.set_rect(sheet.irect, (236, 232, 238))
    for n, i in enumerate(ids):
        p = fitz.Pixmap(os.path.join(DIR, i + "-180.png"))
        if p.alpha: p = fitz.Pixmap(p, 0)
        x, y = pad + (n % cols) * (size + pad), pad + (n // cols) * (size + pad)
        p.set_origin(x, y); sheet.copy(p, p.irect)
    sheet.save(out)
    print("sheet:", out, "order:", ", ".join(ids))
