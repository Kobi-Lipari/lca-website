# Board tools

The scripts used to draw, check and place the boards of the "LCA Look & Feel Options" canvas. Until Mon, Oct 19, 2026 they lived only in a scratch folder. None of them is part of the site or its build.

Two placeholders stand for paths on the machine that runs them:
- `<repo>`: the root of this repository.
- `<scratchpad>`: a scratch folder outside the repository, where boards are drawn, rendered and placed before they are published.

## render.mjs: render a board to PNG

Renders one board (`.dc.html`) in Chromium, so it can be checked by eye before it is published. Run it from the repository root:

```
node docs/redesign/tools/render.mjs <file> <out> <width> 0.5
```

- `<file>`: the board.
- `<out>`: a path prefix in a scratch folder, for example `<scratchpad>/render/out/Club-G`. Its folder must exist. The script writes `<out>.full.png` (the whole board), `<out>.top.png` (the first 1100 pixels) and `<out>.render.html` (the copy it rendered).
- `<width>`: the board's width in pixels (1440 when left out).
- `0.5`: the scale of the PNGs (0.5 when left out).

It prints one line of JSON with the board's rendered height. A board's declared height and its `$preview` height are set to that number rounded up to the next 50.

The canvas serves the kit stylesheet and the photos from `/_blob/` links that do not exist on a local disk, so the script swaps them for files in the repository before it renders:
- `/_blob/6107adb451dbab26ee5d89f4189b81f8` becomes `docs/redesign/lca-redesign-boards/kit.css`.
- Any other `/_blob/` image becomes `public/lca-logo.jpg` when its tag mentions a logo, mark or seal, and the hall photo `src/assets/LCA_Slide_1.jpg` otherwise.
- The `support.js` line is dropped, and any `{{hole}}` is shown as its name.

It finds `<repo>` from its own place, three folders up, so run the copy in this folder, not a copy kept somewhere else.

It needs two things:
- `playwright-core`, which Node looks for in the `node_modules` folders above the script. It comes with the development dependencies WS01 step 20 added (`@playwright/test`, with `playwright-core` held at 1.63.0), on `redesign/ws01-design-system` and on `main` once checkpoint D merges, so `npm install` provides it there. On a branch without it, run `npm install --no-save playwright-core@1.63.0` first.
- Chromium at `/opt/pw-browsers/chromium`, the path written in the script.

Checked on Mon, Oct 19, 2026, from this folder's layout with the repository's `node_modules`: `Work-H-2` rendered at 1440 pixels to 2950, its declared height.

## draw-boards.js: draw and review boards from written specs

A workflow script in the same form as `.claude/workflows/build-slice.js`. Run it with the workflow runner, giving it this file and an args object. For each board, one designer agent (`.claude/agents/designer.md`) draws it from its spec and checks it with the renderer, then a second designer reviews it against the spec, K's notes and the copy rules, fixes it in place, and returns the final heights.

Before running it, set the two constants at the top: `REPO` to the repository root and `S` to the scratch folder. The boards are written to `${S}/canvas-out/project`, the renders go to `${S}/render/out` (create both folders first), and the renderer is the one in this folder.

The args object:

| Key | What it holds |
|---|---|
| `label` | A name for the batch, used in the log and returned with the results. |
| `fb` | The text every prompt starts with: K's notes, verbatim, and how they were read for the round. |
| `from` | Text added to each draw prompt, before the spec. |
| `drawExtra` | More text for each draw prompt. |
| `reviewExtra` | More text for each review prompt, such as what to count. |
| `boards` | The boards to draw. Each one has `file` (the board's file name), `title` (its title on the canvas), `width` (1440 when left out), `page` (the id of its canvas page), `name`, `idea`, `differs` (how it differs from its sibling), `keeps`, `removes` and `spec`, and may set `max_height` (3400 when left out) and `second_max_height` (3000 when left out, for a part 2 named like `Name-2.dc.html`). |
| `specFile` | Optional. A JSON file whose `boards` list holds each board's full spec, matched by `file`; the designers read it first. |
| `drawn` | Optional. A map from a board's file name to a draw result already in hand: that board skips drawing and goes straight to review. |
| `model`, `effort` | Optional. Passed as they are to every agent. |

It returns `{ label, results }`. Each result holds `board` (the board's spec fields), `drawn` (the file, title, width and height, the part 2 file, title and height, the note for the canvas, and anything left unresolved) and `review` (the final heights, what was counted, what was changed and what still concerns the reviewer). Save it as a JSON file: the publish scripts read it.

## publish-pages.py and publish-page.py: place boards in canvas.json

Both read one or more results files from `draw-boards.js`, add each new board and its note to `canvas.json`, write `canvas.json` back, and print the files map for the publish. They work on `canvas-out/project/` in the folder the script sits in, so copy the script into `<scratchpad>` and run it there. Before running it, `<scratchpad>/canvas-out/project/` must hold the new boards and the canvas's `canvas.json`, read from the published canvas first and compared with the last local copy.

`publish-pages.py` places boards on several pages at once. Each board goes on its own `page`, starting at that page's start x, and each page's round note goes in as given:

```
python3 publish-pages.py '<json: {page: start_x}>' '<json: {page: [note_key, note_text]}>' results.json ...
```

`publish-page.py`, the older script, places every board on one page:

```
python3 publish-page.py <page> <start_x> <round_note_key> <round_note_text> results1.json [results2.json ...]
```

The layout is the same in both:
- Each board at y 0, with x stepping along the page by the board's width plus 80.
- Each board's grey note, `s_<Name>`, at the board's x, at y equal to the board's height plus 60, 760 wide.
- A part 2 placed right after its board, with no note.
- The round's teal note at the start x, at y minus 300, 760 wide.
- Every new board added to the end of `order`.

A board already in `canvas.json` is skipped, and a board file that is missing is reported.

The last line printed, `FILES:`, is the files map. `publish-pages.py` lists the new boards only. `publish-page.py` also lists `project/canvas.json`; drop that entry. To publish, give `<scratchpad>/canvas-out` as the root, `project/canvas.json` as the file path, and the new boards alone as the files map. `canvas.json` never goes in the files map.

To keep the repository able to rebuild the canvas, copy the new boards into `docs/redesign/canvas/boards/` and the published `canvas.json` over `docs/redesign/canvas/canvas.json` after each publish.
