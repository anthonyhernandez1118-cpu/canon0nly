# Usage: python3 -I scripts/scrape.py <cache-dir> <out data.json> <out posters.txt>
# Pulls every show from animefillerlist.com. Writes the app's data.json and a list of poster URLs.
import re, json, sys, time, html, os, datetime, urllib.request, urllib.parse
raw, out_json, out_posters = sys.argv[1:4]
os.makedirs(raw, exist_ok=True)
def get(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
        except Exception as e:
            print('retry', url, e, file=sys.stderr); time.sleep(3)
    return None
idx = get('https://www.animefillerlist.com/shows') or ''
shows = sorted(set(re.findall(r'href="/shows/([^"]+)">([^<]+)', idx)))
TYPES = {'Manga Canon': 'M', 'Anime Canon': 'A', 'Mixed Canon/Filler': 'X', 'Filler': 'F'}
row_re = re.compile(r'<tr class="[^"]*" id="eps-[^"]*"><td class="Number">([^<]*)</td><td class="Title"><a[^>]*>(.*?)</a></td><td class="Type"><span>([^<]*)</span></td><td class="Date">([^<]*)</td>', re.S)
poster_re = re.compile(r'src="(https://www\.animefillerlist\.com/sites/default/files/styles/anime_poster/[^"]+)"')
out, posters = [], []
for slug, name in shows:
    path = os.path.join(raw, re.sub(r'[^A-Za-z0-9-]', '_', slug) + '.html')
    if os.path.exists(path):
        page = open(path, encoding='utf-8').read()
    else:
        page = get('https://www.animefillerlist.com/shows/' + slug)
        if page is None: continue
        open(path, 'w', encoding='utf-8').write(page); time.sleep(0.6)
    eps = [[n.strip(), html.unescape(re.sub('<[^>]+>', '', t)).strip(), TYPES.get(ty.strip(), 'F'), d.strip()]
           for n, t, ty, d in row_re.findall(page)]
    if not eps: continue
    s = urllib.parse.unquote(slug)
    out.append({'s': s, 'n': html.unescape(name).strip(), 'e': eps})
    m = poster_re.search(page)
    if m: posters.append(s + ' ' + html.unescape(m.group(1)))
data = {'updated': datetime.date.today().isoformat(), 'shows': out}
json.dump(data, open(out_json, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
open(out_posters, 'w').write('\n'.join(posters) + '\n')
print('shows', len(out), 'episodes', sum(len(s['e']) for s in out))
