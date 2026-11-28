export const meta = {
  name: 'draw-boards',
  description: 'Draw and review one chunk of option boards for the LCA canvas from written specs (args: {label, fb, from, drawExtra, reviewExtra, boards})',
  phases: [
    { title: 'Draw', detail: 'one designer per board, self-checked with the renderer' },
    { title: 'Review', detail: 'a second designer checks each board against its spec, K\'s notes and the rules, and fixes it' },
  ],
}

// Set both before running: <repo> is the repository root, <scratchpad> a scratch folder outside it.
const REPO = '<repo>'
const S = '<scratchpad>'
const P = `${S}/canvas-out/project`
const RENDER = `${REPO}/docs/redesign/tools/render.mjs`
const DECIDED = `${REPO}/docs/redesign/decided-boards`

const RULES = `File rules (each fails silently on the canvas if broken): copy the exact skeleton of an existing board (doctype, charset, title, the line <script src="./support.js"></script>, the kit stylesheet link /_blob/6107adb451dbab26ee5d89f4189b81f8, <x-dc><helmet> holding the Google Fonts link and one <style> block, the closing data-dc-script block with $preview width and height); no {{holes}}, no iframes, nothing animated; the kit's k-* classes from ${REPO}/docs/redesign/lca-redesign-boards/kit.css; the board's title strip, legend with numbered badges and grey "What / Built from / K's feedback applied / Open for K" note as the decided boards carry them (see ${DECIDED}/Tourn-List-Final.dc.html for the title strip and legend pattern, and use its header and footer chrome so the new boards match the decided navigation; ${DECIDED}/Nav-Header-Final.dc.html shows the signed-in header and the My LCA menu). Keep the legend to at most six numbered notes.
Copy rules (non-negotiable): weekday on every date; times as "7:00 PM"; ½ never .5; "US Chess" never USCF; status in words beside any colour; brand gold #c8a94a never text on a light ground (#866a1e for gold-ink text); partner events say "Registers on the organizer's site ↗" and never get Register or a count; no em dashes anywhere, in copy or in notes; no AI references of any kind; no grade or birthdate asked anywhere, no financial-need question; under-18s as first name and last initial on pre-event lists and full names in results; real LCA data from the existing boards and a "Sample data" badge on anything invented; keep the "300+ members" figure where it already appears; no member price on entry fees.
Renderer: node ${RENDER} <file> ${S}/render/out/<Name> <W> 0.5 ; view the PNG after every change, up to 4 rounds, fix overlaps, overflow, clipping and unreadable contrast, and set the declared height and $preview to the rendered height rounded up to the next 50.
Work in ${P} (write new files there; never edit an existing board, in ${P} or under ${REPO}/docs/redesign).`

const DRAW = { type: 'object', properties: { file: { type: 'string' }, title: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' }, second_file: { type: 'string', description: 'the X-2 file name if there is a second board, else empty' }, second_title: { type: 'string' }, second_height: { type: 'number' }, note: { type: 'string', description: 'three short paragraphs for the canvas note: What; Built from; K\'s feedback applied and what is open for K' }, unresolved: { type: 'array', items: { type: 'string' } } }, required: ['file', 'title', 'width', 'height', 'second_file', 'second_title', 'second_height', 'note', 'unresolved'] }
const REVIEW = { type: 'object', properties: { file: { type: 'string' }, height: { type: 'number' }, second_height: { type: 'number' }, counts: { type: 'string', description: 'what the review counted or listed as asked' }, changes: { type: 'array', items: { type: 'string' } }, remaining_concerns: { type: 'array', items: { type: 'string' } } }, required: ['file', 'height', 'second_height', 'counts', 'changes', 'remaining_concerns'] }

const fb = args.fb || ''
const from = args.from || ''
const drawExtra = args.drawExtra || ''
const reviewExtra = args.reviewExtra || ''
const boards = args.boards || []
const specFile = args.specFile || ''
const specLine = b => specFile ? `The full spec for this board is the object whose "file" is "${b.file}" in the boards list of ${specFile}: read that object in full first (its spec, keeps and removes fields), and read the file's flow field so this part matches the others.` : ''
log(`${args.label || 'chunk'}: ${boards.length} boards: ${boards.map(b => b.file).join(', ')}`)

const drawnMap = args.drawn || {}
const MODEL = Object.assign({}, args.model ? { model: args.model } : {}, args.effort ? { effort: args.effort } : {})
const results = await pipeline(boards,
  b => drawnMap[b.file] ? Promise.resolve(drawnMap[b.file]) : agent(`${fb}

${RULES}

DRAW STAGE for ${P}/${b.file} (canvas title "${b.title}", width ${b.width || 1440}px, canvas page "${b.page}"). ${from} ${drawExtra} Draw this spec exactly:

${specLine(b)}
Name: ${b.name}
Idea: ${b.idea}
Differs: ${b.differs}
Keeps: ${b.keeps || '(see the spec file)'}
Removes: ${b.removes || '(see the spec file)'}
Spec: ${b.spec || '(see the spec file)'}

Height limit: the main board under ${b.max_height || 3400}px; a second board, if the spec has one, under ${b.second_max_height || 3000}px as ${b.file.replace('.dc.html', '-2.dc.html')}. The board carries: a title strip, a legend "Notes on this board" of at most six numbered notes badging where K's feedback landed, and a grey note with What / Built from / K's feedback applied / Open for K. Return structured output.`, Object.assign({ label: `draw:${b.file}`, phase: 'Draw', agentType: 'designer', schema: DRAW }, MODEL)),
  (drawn, b) => {
    if (!drawn) return null
    return agent(`${fb}

${RULES}

REVIEW STAGE for ${P}/${b.file} ("${b.title}")${drawn.second_file ? ` and ${P}/${drawn.second_file}` : ''}, drawn by another designer from this spec:
${specLine(b)}
Name: ${b.name}
Idea: ${b.idea}
Differs: ${b.differs}
Keeps: ${b.keeps || '(see the spec file)'}
Removes: ${b.removes || '(see the spec file)'}
Spec: ${b.spec || '(see the spec file)'}

Read the file in full, render it and view the PNG. ${reviewExtra} Check and FIX in the file: the spec's idea and the way it differs from its sibling are obvious at a glance; every region the spec names is there with its copy and states; every point of K's feedback holds; every rule above holds (weekday on every date, 7:00 PM, ½, US Chess, status in words, gold never as text on light ground, no em dashes, no AI references, Sample badges on invented data, no grade or birthdate, no financial-need question); the header and footer match the decided chrome; nothing overlaps, overflows or clips at the board's width; the numbered legend has at most six notes; the declared height matches the render and stays under the limit (main ${b.max_height || 3400}px, second ${b.second_max_height || 3000}px). Return the final heights, what you counted, what you changed and what still concerns you.`, Object.assign({ label: `review:${b.file}`, phase: 'Review', agentType: 'designer', schema: REVIEW }, MODEL))
      .then(review => ({ board: { file: b.file, title: b.title, width: b.width || 1440, page: b.page, name: b.name, idea: b.idea, differs: b.differs }, drawn, review }))
  })

return { label: args.label || 'chunk', results: results.filter(Boolean) }
