# Usage: python3 -I scripts/posters.py <posters.txt> <download-dir> <out posters dir> [have.txt]
# Makes a 160x240 WebP poster per show. Skips shows already in the out dir or listed in have.txt.
import sys, os, re, time, io, urllib.request
from PIL import Image
lst, dl, outdir = sys.argv[1:4]
have = set(open(sys.argv[4]).read().split()) if len(sys.argv) > 4 else set()
os.makedirs(dl, exist_ok=True); os.makedirs(outdir, exist_ok=True)
def safe(s): return re.sub(r'[^a-z0-9-]', '_', s.lower())
made = []
for line in open(lst):
    if not line.strip(): continue
    slug, url = line.strip().split(' ', 1)
    name = safe(slug)
    out = os.path.join(outdir, name + '.webp')
    if name in have or os.path.exists(out): continue
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        im = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert('RGB'); time.sleep(0.3)
        w, h = im.size
        if w / h > 2 / 3: nw = int(h * 2 / 3); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else: im = im.crop((0, 0, w, int(w * 3 / 2)))
        im.resize((160, 240), Image.LANCZOS).save(out, 'WEBP', quality=72); made.append(name)
    except Exception as e:
        print('skip', slug, e, file=sys.stderr)
print('new posters', len(made)); print('\n'.join(made))
