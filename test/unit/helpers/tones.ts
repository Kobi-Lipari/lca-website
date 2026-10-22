// test/unit/helpers/tones.ts
//
// The tone tokens of src/index.css (WS01 step 24), read from the stylesheet,
// for tokens.test.ts.
//
// A tone token is one shade of a status colour the pages used, named for its
// tone and Tailwind's step: --ok-700 is emerald-700 with newLook off. A
// second Tailwind colour of a tone carries its own name: --ok-green-700 is
// green-700. Under the new look every shade of a tone is that tone's tint (the
// steps up to 300) or its words (400 and up), from the Looks-3 status tags.
import { indexCssRules, read, type CssRule } from './cssTokens'

export type Tone = 'ok' | 'bad' | 'warn' | 'info' | 'quiet'

/** Each tone's own Tailwind colour, the one its plain step names stand for. */
export const TONE_FAMILY: Record<Tone, string> = { ok: 'emerald', bad: 'red', warn: 'amber', info: 'blue', quiet: 'gray' }

/** The tokens each tone's words and tint are under the new look. */
export const TONE_WORDS: Record<Tone, string> = { ok: '--ok', bad: '--bad', warn: '--status-soon', info: '--status-partner', quiet: '--status-closed' }
export const TONE_TINT: Record<Tone, string> = {
  ok: '--status-open-tint',
  bad: '--status-full-tint',
  warn: '--status-soon-tint',
  info: '--status-partner-tint',
  quiet: '--status-closed-tint',
}

export interface ToneToken {
  /** The custom property, such as "--ok-green-700". */
  name: string
  tone: Tone
  /** The Tailwind colour it stands for with newLook off: "green". */
  family: string
  step: number
  /** "words" from step 400 up, "tint" below. */
  role: 'words' | 'tint'
  /** Its value on the plain :root. */
  legacy: string
}

const TONE_TOKEN = /^--(ok|bad|warn|info|quiet)(?:-([a-z]+))?-(\d{2,3})$/

/** Every tone token on the plain :root of src/index.css, in order. */
export function toneTokens(rules: CssRule[] = indexCssRules()): ToneToken[] {
  const root = rules.find((r) => r.selector === ':root' && !r.within)
  if (!root) throw new Error('no plain :root in src/index.css')
  const out: ToneToken[] = []
  for (const [name, legacy] of root.decls) {
    const m = name.match(TONE_TOKEN)
    if (!m) continue
    const tone = m[1] as Tone
    const step = Number(m[3])
    out.push({ name, tone, family: m[2] ?? TONE_FAMILY[tone], step, role: step >= 400 ? 'words' : 'tint', legacy })
  }
  return out
}

/**
 * The tokens that stand for one hex colour the pages used, at that colour
 * with newLook off: the info banner's blue (the Scheduled tag, the info
 * tone's words under the new look) and the Facebook links' blue.
 */
export const HEX_TOKENS = {
  '--info-banner': { legacy: '#1e4d7b' },
  '--facebook-link': { legacy: '#1668d8' },
} as const

/** A Tailwind colour's value in Tailwind's own theme, such as "--color-emerald-700". */
export function tailwindColour(family: string, step: number): string {
  const theme = read('node_modules/tailwindcss/theme.css')
  const m = theme.match(new RegExp(`--color-${family}-${step}:\\s*([^;]+);`))
  if (!m) throw new Error(`--color-${family}-${step} is not in tailwindcss/theme.css`)
  return m[1].trim()
}
