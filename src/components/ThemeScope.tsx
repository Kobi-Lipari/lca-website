// src/components/ThemeScope.tsx
//
// Draws its children in one of the site's looks: base, heritage, live or
// scholastic (src/lib/themeScopes.ts). It puts data-theme on a wrapper, and
// the token blocks for every look are already in src/index.css, so a change
// of look recolours the page at once, with no flash of the base colours.
//
// By default the wrapper is display: contents, so it adds no box and moves
// nothing on the page; the tokens still reach the children, because custom
// properties are inherited through it. Pass layout="box" when the wrapper
// should be a real element that draws its own ground (className, a
// background), such as a page's outer wrapper: a div, or a section with a
// heading, inside the <main> that src/App.tsx already puts around every
// route, as HeritageLayout's is. It is never a main: that would put a second
// main landmark on the page. A section should use layout="box" too.
//
// The scope="base" wrapper writes data-theme="", which puts the base look
// back inside heritage, for the editors and forms on a heritage page.
//
// A look's own fonts load the first time that look renders, from a CSS file
// imported on demand, each in a file of its own that no other page fetches:
// src/styles/themes/heritage.css for heritage (its faces, and the type rules
// its pages opt into) and src/styles/themes/live.css for live. Scholastic's
// arrive with the Scholastic work; until then that look changes colours
// only. The file loads whatever the switches say: its rules apply only under
// the new look, as the scope colours do, so this component reads no switch.
// The loader, src/lib/scopeStylesheets.ts, asks for each file once and
// handles a failed load itself. A scope asks for its file in an effect,
// after its first paint, so an element that takes one of heritage's type
// rules would be drawn first in the base type and move when the file
// arrives. A page that should not paint before its look's type is in place
// draws ScopeStylesheetReady beside its content, inside a Suspense boundary,
// as HeritageLayout (src/layouts/HeritageLayout.tsx) does: it holds the
// boundary's content until the file has arrived or could not be loaded, and
// for HOLD_AT_MOST_MS at most (the loader's), after which the content is
// drawn in the type it has and the look's type follows when the file does.
//
// Looks nest one level only, and base inside heritage is the one nesting
// allowed (nestingProblem in src/lib/themeScopes.ts). A nesting outside that
// rule is reported in the console in development, in the tests and in the
// accessibility test build; the site's own build leaves the check out.
import { createContext, use, useContext, useEffect, useMemo, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { loadScopeStylesheet, scopeStylesheetPending } from '@/lib/scopeStylesheets'
import { dataThemeOf, nestingProblem, type ThemeScopeName } from '@/lib/themeScopes'

/** The looks around this point of the page, outermost first. */
const ScopeAncestors = createContext<readonly ThemeScopeName[]>([])

const CONTENTS: CSSProperties = { display: 'contents' }

export interface ThemeScopeProps extends HTMLAttributes<HTMLElement> {
  /** The look to draw the children in. */
  scope: ThemeScopeName
  /** "contents" (the default) adds no box; "box" makes the wrapper a real element. */
  layout?: 'contents' | 'box'
  /** The wrapper element: never a main, since the site's own main holds every page. */
  as?: 'div' | 'section'
  children?: ReactNode
}

export function ThemeScope({ scope, layout = 'contents', as: Tag = 'div', style, children, ...rest }: ThemeScopeProps) {
  const ancestors = useContext(ScopeAncestors)
  const inside = useMemo(() => [...ancestors, scope], [ancestors, scope])

  useEffect(() => {
    void loadScopeStylesheet(scope)
  }, [scope])

  useEffect(() => {
    if (import.meta.env.MODE === 'production') return
    const problem = nestingProblem(ancestors, scope)
    if (problem) console.warn(problem)
  }, [ancestors, scope])

  return (
    <Tag {...rest} data-theme={dataThemeOf(scope)} style={layout === 'contents' ? { ...style, ...CONTENTS } : style}>
      <ScopeAncestors.Provider value={inside}>{children}</ScopeAncestors.Provider>
    </Tag>
  )
}

/**
 * Draws nothing, and holds the content of the nearest Suspense boundary
 * until the look's stylesheet has arrived, or could not be loaded, so that
 * content first paints in the look's own type; never longer than the
 * loader's HOLD_AT_MOST_MS, so a slow or stalled file does not keep the page
 * from a visitor. It asks for the file when it renders, if no scope has
 * asked yet. Put it beside the content, inside the boundary, after the part
 * that loads on demand, so both are on their way at once. A look with no
 * stylesheet of its own holds nothing.
 */
export function ScopeStylesheetReady({ scope }: { scope: ThemeScopeName }) {
  const pending = scopeStylesheetPending(scope)
  if (pending) use(pending)
  return null
}
