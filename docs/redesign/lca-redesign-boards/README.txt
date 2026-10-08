LCA redesign: board sources (design reference for the build)

boards/*.dc.html   The 86 artboards from the "LCA Look & Feel Options" canvas, as plain HTML with inline styles.
                   Read them for exact layout, hierarchy and copy. They link a shared stylesheet and photos by
                   /_blob/ URLs that only resolve on the canvas, so read the source rather than opening them.
kit.css            The shared stylesheet those boards use (k-* classes).
canvas.json        The canvas index: every board's title and page, plus the grey notes (What / Borrowed from / Trade-off).
board_notes.json   Per board: What, Borrowed from, Trade-off and Build notes (data, API and component implications).
Board names match the ones used in REDESIGN_SPEC.md (e.g. Event-A, Clubs-B).
Where a board and REDESIGN_SPEC.md disagree (e.g. the lunch-status discount, minors' initials), the brief wins.
