// src/contexts/heritage-layout.ts
//
// Whether a part of the page is drawn inside HeritageLayout
// (src/layouts/HeritageLayout.tsx), which draws the six heritage pages in
// the heritage look when the themeHeritage switch is on. The layout provides
// it; PageHero, GovLayout, GovernanceDocuments and the six pages read it to
// put on the hooks src/styles/themes/heritage.css styles (data-heritage), the
// thick-thin rules and the seal. Outside the layout every reader gets false
// and draws exactly what it drew before, so with the switch off the pages'
// markup is unchanged, and PageHero's other pages never take a hook.
//
// The hooks are attributes the stylesheet reads only under the new look, so
// they change nothing with newLook off. The rules and the seal are drawn
// elements, so they wait for newLook themselves (useHeritageOrnaments): with
// themeHeritage on and newLook off the six pages look as they do today.
//
// The context object and its hooks are kept apart from any component, as in
// auth-context.ts, so the components that read it keep Fast Refresh.
import { createContext, useContext } from 'react'
import { FEATURES } from '@/lib/features'

/** The words of data-heritage, as src/styles/themes/heritage.css names them. */
export type HeritageHook = 'display' | 'figure' | 'reader' | 'card' | 'table' | 'mat'

/** True inside HeritageLayout. */
export const HeritageLayoutContext = createContext(false)

/** Whether this part of the page is drawn inside HeritageLayout. */
export function useInHeritageLayout(): boolean {
  return useContext(HeritageLayoutContext)
}

/**
 * Whether the look's ornaments, the thick-thin rules and the seal, are drawn
 * here: inside HeritageLayout and under the new look, like every other part
 * of the look a visitor can see.
 */
export function useHeritageOrnaments(): boolean {
  return useContext(HeritageLayoutContext) && FEATURES.newLook
}

const ON = (word: HeritageHook): HeritageHook => word
const OFF = (): undefined => undefined

/**
 * The value of an element's data-heritage attribute: the word inside
 * HeritageLayout, and undefined outside it, which React draws as no
 * attribute at all.
 */
export function useHeritageHook(): (word: HeritageHook) => HeritageHook | undefined {
  return useContext(HeritageLayoutContext) ? ON : OFF
}
