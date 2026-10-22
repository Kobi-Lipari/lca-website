// src/layouts/HeritageLayout.tsx
//
// The layout route of the six heritage pages (HERITAGE_ROUTES in
// src/lib/themeScopes.ts): About, Board, Bylaws, Minutes, Annual meeting and
// Champions. src/App.tsx loads it on demand and holds the six routes inside
// it only when the themeHeritage switch is on; with the switch off the six
// are listed among the other routes, as they always were, and this file is
// never loaded. The pages are drawn as they are: GovLayout stays inside the
// four that draw it, and the other two draw PageHero themselves.
//
// The look. The pages are drawn in the Heritage Club look through ThemeScope,
// as a box: a div inside the <main> that src/App.tsx puts round every route,
// never a second main landmark. The box paints the look's paper ground
// (bg-ground, the ground token itself) and its ink, and casts its ground
// downward as a shadow, which the footer, drawn after it, covers; so on a
// page shorter than the window the paper runs down to the footer, and a
// shadow adds nothing to the page's height or its scrolling. The header and
// the footer sit outside the box, in the base look. The colours, like every
// rule of the look, wait for the newLook switch: with themeHeritage on and
// newLook off the six pages look as they do today.
//
// The type. Under the new look the look's stylesheet
// (src/styles/themes/heritage.css) is in place before a heritage page first
// paints: ScopeStylesheetReady holds the page in the Suspense boundary below
// until the file has arrived, or could not be loaded (the loader,
// src/lib/scopeStylesheets.ts, tries a failed file once more itself), and
// the page's own code is fetched at the same time. The hold is bounded: after
// the loader's HOLD_AT_MOST_MS the page is drawn in the type it has, and the
// look's type takes its place when the file arrives, so a stalled file never
// keeps a visitor from the page. With newLook off nothing is held, since
// none of the file's rules apply then; the scope still asks for the file. While
// the page's code, or the file, is on its way the boundary shows the site's
// loading line in a box at least the window's height, so on a move from
// another page of the site the footer stays below the window instead of
// rising into view and dropping again when the page arrives. On a first
// visit the site's own loading line (src/App.tsx) stands while this file's
// code arrives, before the box can be drawn.
//
// The hooks. The layout tells the parts inside it that they are in the
// layout (src/contexts/heritage-layout.ts), so PageHero, GovLayout,
// GovernanceDocuments and the pages put on the hooks the stylesheet styles,
// and under the new look the thick-thin rules and the seal, and none of
// them does anywhere else.

import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { ScopeStylesheetReady, ThemeScope } from '@/components/ThemeScope'
import { HeritageLayoutContext } from '@/contexts/heritage-layout'
import { FEATURES } from '@/lib/features'

/** The site's loading line, in a box at least the window's height. */
function HeldPage() {
  return (
    <div className="min-h-screen">
      <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  )
}

export function HeritageLayout() {
  return (
    <ThemeScope
      scope="heritage"
      layout="box"
      data-layout="heritage"
      className="bg-ground text-foreground shadow-[0_100vh_0_100vh_var(--ground)]"
    >
      <HeritageLayoutContext.Provider value={true}>
        <Suspense fallback={<HeldPage />}>
          <Outlet />
          {FEATURES.newLook && <ScopeStylesheetReady scope="heritage" />}
        </Suspense>
      </HeritageLayoutContext.Provider>
    </ThemeScope>
  )
}
