// domain/households/publicName.ts
//
// How a player's name is shown to the public. The rule comes from
// docs/redesign/DESIGN_REPLAN_phase1.md:
// - line 36 (4.4): on the public "who's registered" list, players under 18
//   show as first name and last initial ("Priya S."); results, standings and
//   winners keep full names (D3).
// - line 210: on the pre-event entrants list a player is shortened while any
//   guardian link is active, or when their entry ticks a scholastic
//   eligibility box (saved in registrations.eligibility_json). LCA stores no
//   age, so these are the only signals.
// - line 256: the public event endpoint shortens a name when the player has an
//   active guardian link or the entry's eligibility_json is set.
// - line 352: entrants list as above; pairings, standings, results and winners
//   show full names (D3).
// - line 394: no per-event public_minor_names setting is added; dependent
//   profiles (players with an active guardian link) and entries that ticked
//   "I'm under 18" are shortened, and results keep full names.
// Decision D3 (docs/redesign/REDESIGN_SPEC.md, section 5) is why results
// congratulate kids by their full names.
//
// Being in a household is not the trigger by itself. A player whose guardian
// links have all ended (handed over at 18, for example) shows in full unless
// the entry itself is marked under 18.

/** Where the name appears. 'entrants' is the pre-event list of who has entered; 'results' covers pairings, standings, results, winners and recaps. */
export type NameContext = 'entrants' | 'results'

export interface PublicNameInput {
  fullName: string
  /** The player has at least one guardian link that has not ended. */
  hasActiveGuardianLink: boolean
  /** This entry is marked under 18: its eligibility_json is set, or "I'm under 18" was ticked. */
  entryMarkedMinor: boolean
}

/** Words that start a surname when they come before the last word: "de la Cruz", "Le Blanc", "Van Dyke", "St. Romain". */
const SURNAME_PARTICLES = new Set([
  'da', 'das', 'de', 'del', 'della', 'den', 'der', 'des', 'di', 'dos', 'du',
  'la', 'le', 'saint', 'sainte', 'st', 'st.', 'ste', 'ste.', 'ter', 'van', 'von',
])

/** Name endings that are not a surname. */
const SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv'])

const isSuffix = (word: string) => SUFFIXES.has(word.toLowerCase())

/** "Robichaux, Leo" reads as "Leo Robichaux"; "Leo Robichaux, Jr." drops the suffix. */
function inReadingOrder(name: string): string {
  const parts = name.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return parts[0] ?? ''
  if (parts.slice(1).every((p) => p.split(' ').every(isSuffix))) return parts[0]
  return `${parts[1]} ${parts[0]}`
}

/** First name and last initial: "Leo Robichaux" is "Leo R.", "Ana de la Cruz" is "Ana D.". A single name is left as it is. */
export function firstNameLastInitial(fullName: string): string {
  const words = inReadingOrder(fullName.trim().replace(/\s+/g, ' ')).split(' ').filter(Boolean)
  while (words.length > 1 && isSuffix(words[words.length - 1])) words.pop()
  if (words.length < 2) return words.join(' ')
  let start = words.length - 1
  while (start > 1 && SURNAME_PARTICLES.has(words[start - 1].toLowerCase())) start--
  const letter = /\p{L}/u.exec(words[start])?.[0]
  return letter ? `${words[0]} ${letter.toUpperCase()}.` : words[0]
}

/**
 * The name to show the public. In 'entrants', a player with an active
 * guardian link or an entry marked under 18 is shortened to first name and
 * last initial; everyone else, and every name in 'results', is shown in full.
 */
export function publicName(player: PublicNameInput, context: NameContext): string {
  const full = player.fullName.trim().replace(/\s+/g, ' ')
  const shorten = context === 'entrants' && (player.hasActiveGuardianLink || player.entryMarkedMinor)
  return shorten ? firstNameLastInitial(full) : full
}
