"""Place drawn boards on their own pages and print the files map.
usage: python3 publish-pages.py '<json: {page: start_x}>' '<json: {page: [note_key, note_text]}>' results.json ...
Each board goes on its own page (board.page), x stepping by w+80 per page."""
import json, sys, os
starts = json.loads(sys.argv[1]); rnotes = json.loads(sys.argv[2]); files = sys.argv[3:]
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'canvas-out', 'project')
cj = json.load(open(os.path.join(P, 'canvas.json')))
x = dict(starts); added = []
def place(page, fname, title, w, h, note):
    if fname in cj['boards']: print('already placed', fname); return
    if not os.path.exists(os.path.join(P, fname)): print('MISSING', fname); return
    cj['boards'][fname] = {'h': h, 'page': page, 'title': title, 'w': w, 'x': x[page], 'y': 0}
    if note: cj['notes']['s_' + fname.replace('.dc.html', '')] = {'fill': 'gray', 'page': page, 'text': note, 'w': 760, 'x': x[page], 'y': h + 60}
    if fname not in cj['order']: cj['order'].append(fname)
    added.append((page, fname, x[page], w, h)); x[page] += w + 80
for f in files:
    for r in json.load(open(f))['results']:
        b, dr, rv = r['board'], r['drawn'], r['review'] or {}
        page = b['page']; main = os.path.basename(dr['file'])
        w = int(dr.get('width') or b.get('width') or 1440); h = int(rv.get('height') or dr.get('height'))
        place(page, main, dr.get('title') or b['title'], w, h, dr.get('note', ''))
        sec = dr.get('second_file') or ''
        if sec:
            sh = int(rv.get('second_height') or dr.get('second_height') or 0)
            if sh: place(page, os.path.basename(sec), dr.get('second_title') or (dr.get('title') + ', part 2'), w, sh, '')
for page, (key, text) in rnotes.items():
    cj['notes'][key] = {'fill': 'teal', 'page': page, 'text': text, 'w': 760, 'x': starts[page], 'y': -300}
json.dump(cj, open(os.path.join(P, 'canvas.json'), 'w'), indent=1, ensure_ascii=False)
print('placed', len(added)); [print(' ', a) for a in added]
print('FILES:', json.dumps({f'project/{a[1]}': f'project/{a[1]}' for a in added}))
