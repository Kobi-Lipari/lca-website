// domain/format/timeControl.ts
// Chess clock shorthand gets a plain companion:
//   "G/90+30"  -> "G/90+30 · 90 min each + 30 sec per move"
//   "G/30;d5"  -> "G/30;d5 · 30 min each + 5 sec delay"
//   "G/60"     -> "G/60 · 60 min each"
// "G" (game in) and "SD" (sudden death) both read as one period. An
// increment may be written "+30", "+30i" or "inc 30"; a delay "d5", ";d5" or
// " d5". Anything else (multi-period controls such as "40/90, SD/30;d5",
// free text) is returned unchanged, because a wrong companion is worse than
// none.

const SINGLE_PERIOD =
  /^(?:G|SD)\s*\/\s*(\d{1,3})(?:\s*(?:\+\s*(\d{1,3})\s*i?|[;,]?\s*inc\s*(\d{1,3})|[;,]?\s*d\s*(\d{1,3})))?$/i

/**
 * The plain words for a time control ("90 min each + 30 sec per move"), or
 * null when the shorthand is not one this helper can read.
 */
export function describeTimeControl(text: string | null | undefined): string | null {
  if (!text) return null
  const m = SINGLE_PERIOD.exec(text.trim())
  if (!m) return null
  const [, minutes, plus, inc, delay] = m
  if (Number(minutes) === 0) return null
  const increment = plus ?? inc
  let words = `${Number(minutes)} min each`
  if (increment !== undefined) words += ` + ${Number(increment)} sec per move`
  if (delay !== undefined) words += ` + ${Number(delay)} sec delay`
  return words
}

/**
 * The shorthand followed by its plain companion: "G/90+30 · 90 min each +
 * 30 sec per move". Unknown text comes back unchanged; null and undefined
 * give "".
 */
export function formatTimeControl(text: string | null | undefined): string {
  if (text === null || text === undefined) return ''
  const words = describeTimeControl(text)
  return words ? `${text.trim()} · ${words}` : text
}
