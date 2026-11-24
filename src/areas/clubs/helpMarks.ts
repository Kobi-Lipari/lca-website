// src/areas/clubs/helpMarks.ts
//
// What the small question marks of Help read from the page around them
// (src/areas/clubs/components/HelpMark.tsx), kept in a file of its own so
// each component file exports only components
// (react-refresh/only-export-components): whether a mark stands inside a
// shut fieldset, and the four choices the club editor's Help words follow.
import { createContext } from 'react'

/**
 * True inside a shut fieldset, the observer's view-only form, where a button
 * is disabled whatever it is for: the marks there are drawn as spans that
 * answer as buttons, which a fieldset does not shut.
 */
export const HelpMarksShut = createContext(false)

/** What the club editor's Help words follow: whose club it is, the two switches, and whether the admin fields are drawn. */
export interface EditorWords {
  /** The club is the reader's own, as for its rep: only then does Help speak of "your club". */
  own: boolean
  emailHidden: boolean
  /** The new club pages are on (clubPagesOn), which show the contact name and the place's note. */
  pagesOn: boolean
  showAdmin: boolean
}

/** Given by the club editor to every part it draws; a part drawn outside the editor reads none and draws no mark. */
export const EditorHelpWords = createContext<EditorWords | null>(null)
