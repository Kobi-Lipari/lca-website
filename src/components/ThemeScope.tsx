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
// route. Do not render it as a page's main (as="main"): that would put a
// second main landmark on the page. A section should use layout="box" too.
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
// The file is asked for in an effect, after the scope's first paint, so an
// element that takes one of heritage's type rules is drawn first in the base
// type and moves when the file arrives (REDESIGN_STATUS.md, Follow-ups,
// step 30).
//
// Looks nest one level only, and base inside heritage is the one nesting
// allowed (nestingProblem in src/lib/themeScopes.ts). A nesting outside that
// rule is reported in the console in development, in the tests and in the
// accessibility test build; the site's own build leaves the check out.
import { createContext, useContext, useEffect, useMemo, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { dataThemeOf, nestingProblem, type ThemeScopeName } from '@/lib/themeScopes'

/** The looks around this point of the page, outermost first. */
const ScopeAncestors = createContext<readonly ThemeScopeName[]>([])

/** Each look's font CSS, imported the first time the look renders. */
const SCOPE_FONTS: Partial<Record<ThemeScopeName, () => Promise<unknown>>> = {
  heritage: () => import('@/styles/themes/heritage.css'),
  live: () => import('@/styles/themes/live.css'),
}

const requested = new Set<ThemeScopeName>()

function loadScopeFonts(scope: ThemeScopeName) {
  const load = SCOPE_FONTS[scope]
  if (!load || requested.has(scope)) return
  requested.add(scope)
  // Without its file a look keeps the type it had before the file arrived,
  // so a failed load is not an error for the visitor. Forgetting the failure
  // lets a later render call import() again, but in a built site that second
  // call fetches nothing: Vite's preload helper remembers each stylesheet it
  // has added and leaves the failed <link> in the page, so the call resolves
  // at once and the file stays missing until the page is reloaded. A loader
  // that must try again has to add a link of its own (REDESIGN_STATUS.md,
  // Follow-ups, step 30).
  load().catch(() => requested.delete(scope))
}

const CONTENTS: CSSProperties = { display: 'contents' }

export interface ThemeScopeProps extends HTMLAttributes<HTMLElement> {
  /** The look to draw the children in. */
  scope: ThemeScopeName
  /** "contents" (the default) adds no box; "box" makes the wrapper a real element. */
  layout?: 'contents' | 'box'
  /** The wrapper element. */
  as?: 'div' | 'main' | 'section'
  children?: ReactNode
}

export function ThemeScope({ scope, layout = 'contents', as: Tag = 'div', style, children, ...rest }: ThemeScopeProps) {
  const ancestors = useContext(ScopeAncestors)
  const inside = useMemo(() => [...ancestors, scope], [ancestors, scope])

  useEffect(() => {
    loadScopeFonts(scope)
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
