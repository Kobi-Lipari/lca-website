"""Place drawn boards on a canvas page and list the files to publish.
usage: python3 publish-page.py <page> <start_x> <round_note_key> <round_note_text> results1.json [results2.json ...]
Reads <scratchpad>/canvas-out/project/canvas.json, appends boards (x stepping by w+80), notes s_<Name> (y=h+60, w 760, gray), the round note at (start_x, -300), and the order list. Prints the files map lines."""
import json, sys, os
page, start_x, rkey, rtext = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
files = sys.argv[5:]
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'canvas-out', 'project')
cj = json.load(open(os.path.join(P, 'canvas.json')))
x = start_x
added = []
def place(fname, title, w, h, note):
    global x
    if fname in cj['boards']:
        print('already placed, skipping', fname); return
    if not os.path.exists(os.path.join(P, fname)):
        print('MISSING FILE', fname); return
    cj['boards'][fname] = {'h': h, 'page': page, 'title': title, 'w': w, 'x': x, 'y': 0}
    key = 's_' + fname.replace('.dc.html', '')
    if note:
        cj['notes'][key] = {'fill': 'gray', 'page': page, 'text': note, 'w': 760, 'x': x, 'y': h + 60}
    if fname not in cj['order']:
        cj['order'].append(fname)
    added.append((fname, x, w, h))
    x += w + 80
for f in files:
    d = json.load(open(f))
    for r in d['results']:
        b, dr, rv = r['board'], r['drawn'], r['review']
        main = os.path.basename(dr['file'])
        w = int(dr.get('width') or b.get('width') or 1440)
        h = int(rv.get('height') or dr.get('height'))
        place(main, dr.get('title') or b['title'], w, h, dr.get('note', ''))
        sec = dr.get('second_file') or ''
        if sec:
            sec = os.path.basename(sec)
            sh = int(rv.get('second_height') or dr.get('second_height') or 0)
            if sh:
                place(sec, dr.get('second_title') or (dr.get('title') + ', part 2'), w, sh, '')
if rkey and rtext:
    cj['notes'][rkey] = {'fill': 'teal', 'page': page, 'text': rtext, 'w': 760, 'x': start_x, 'y': -300}
json.dump(cj, open(os.path.join(P, 'canvas.json'), 'w'), indent=1, ensure_ascii=False)
print('placed', len(added), 'boards; next x', x)
for a in added: print(' ', a)
print('FILES:', json.dumps({f'project/{a[0]}': f'project/{a[0]}' for a in added} | {'project/canvas.json': 'project/canvas.json'}))
