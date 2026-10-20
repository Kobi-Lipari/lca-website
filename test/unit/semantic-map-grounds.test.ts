// test/unit/semantic-map-grounds.test.ts
//
// WS01 step 23: the grounds under the classes the colour map writes and the
// classes it keeps, read from the JSX of every TSX file with the TypeScript
// parser (test/unit/helpers/jsxClasses.ts). semantic-map.test.ts holds the
// files to the map; this file checks that what the map says about each
// ground is true of the code:
//
// - each opaque bg-white left is a white mat for a logo or the sign-in QR
//   code and holds no text, and each translucent white veil left sits on a
//   navy or dark ground, here, wherever its component is drawn, or in the
//   branch a component takes when its caller says it is on navy;
// - navy text that stays navy (text-brand-navy) sits on an opaque gold fill
//   that nothing else in its className can replace;
// - text on a navy fill (bg-brand-navy) stays light in dark mode: no text
//   colour that follows the look can apply with the fill, and a Button or
//   Badge filled navy by its className, whose label would otherwise be
//   text-primary-foreground (the dark ground's colour in dark mode), names
//   text-white or dark:text-white;
// - a navy ground drawn with an inline style that holds a control is marked
//   data-ground="dark", data-ground="dark" sits only on dark grounds, and
//   the gold focus ring rule names every navy ground class the files use;
// - a light card that holds a control inside a navy band, in its own file or
//   in any place its component is drawn, is a menu (bg-popover) whose
//   controls the focus ring rules give the look's own ring back; any other
//   would get the band's gold ring on a light ground;
// - text-ink sits on no fixed light tint, where it would be light on light
//   in dark mode: step 24 moved the two places step 23 recorded onto the ok
//   tint, which follows the look. Since step 24 no words colour that follows
//   the look sits on one either, and no veil that follows the look lies over
//   one: the club map's paper, which stays light in every look, takes words
//   and a veil that stay as the light look draws them. Which colours follow
//   the look is read from src/index.css, so a new token is placed by its values.
//
// Each check is run on a planted file first, to show it finds what it looks for.
import { describe, expect, it } from 'vitest'
import { DEFAULT_MAP, loadMap, parseToken, tokensOf, tsxFiles, type ClassToken } from '../../scripts/codemods/semantic-colours'
import { contrast, indexCssRules, parseRules, read, ROOT, rootTokens, scopeTokens, type CssRule } from './helpers/cssTokens'
import { descendants, exclusive, jsxTree, merged, selfAndAncestors, type JsxNode, type Piece } from './helpers/jsxClasses'

const map = loadMap(DEFAULT_MAP)
const ALL = tsxFiles(ROOT).flatMap((f) => jsxTree(f))

const where = (n: JsxNode) => `${n.file}:${n.line} <${n.tag}>`
const tokens = (n: JsxNode): Array<{ token: ClassToken; piece: Piece }> =>
  n.pieces.flatMap((piece) => tokensOf(piece.text).map(({ token }) => ({ token, piece })))
const plain = (t: ClassToken) => t.variants === '' && t.modifier === '' && t.bang === ''

/** Elements a keyboard can reach, by tag. */
const FOCUSABLE = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary', 'Link', 'NavLink', 'Button'])
const holdsControl = (n: JsxNode) => descendants(n).some((d) => FOCUSABLE.has(d.tag))

/** An inline navy ground: backgroundColor set to LCA.navy, a NAVY constant or the literal. */
const INLINE_NAVY = /backgroundColor:\s*(LCA\.navy|NAVY|['"]#1a2744['"])\s*[,}]/

/** The branch a component takes when its caller says it is drawn on navy (FilterDropdown, MultiSelectDropdown). */
const ON_NAVY = "on === 'navy'"

/** A navy or dark ground: a navy fill class, an inline navy, data-ground="dark", or PageHero (its root is navy). */
function isDarkGround(n: JsxNode): boolean {
  return (
    tokens(n).some(({ token }) => plain(token) && (token.utility === 'bg-brand-navy' || token.utility === 'bg-lca-navy')) ||
    INLINE_NAVY.test(n.style) ||
    n.ground !== null ||
    n.tag === 'PageHero'
  )
}

/**
 * Whether an element sits on a navy or dark ground: it or an ancestor in its
 * own file is one, or the component it is drawn in is used only on one.
 */
function onDarkGround(n: JsxNode, depth = 0): boolean {
  const chain = selfAndAncestors(n)
  if (chain.some(isDarkGround)) return true
  const component = chain[chain.length - 1].component
  if (!component || depth > 3) return false
  const uses = ALL.filter((u) => u.tag === component)
  return uses.length > 0 && uses.every((u) => onDarkGround(u, depth + 1))
}

/**
 * What a portal draws at the end of <body>, outside the element that holds it
 * in the JSX: the content of DialogContent and SelectContent
 * (src/components/ui), and anything inside a Portal.
 */
const PORTALLED = /^(DialogContent|SelectContent|[\w.]*Portal)$/

/**
 * Whether an element is drawn inside a navy or dark ground in at least one
 * place: a ground above it in its own file, or above a place its component is
 * drawn, followed up through the callers in `all`. A ground above a portal
 * does not hold what the portal draws.
 */
function drawnInDarkGround(n: JsxNode, all: JsxNode[], depth = 0): boolean {
  const chain = selfAndAncestors(n)
  const portal = chain.findIndex((a) => PORTALLED.test(a.tag))
  if (chain.slice(1, portal < 0 ? undefined : portal).some(isDarkGround)) return true
  const component = chain[chain.length - 1].component
  if (portal >= 0 || !component || depth > 3) return false
  return all.some((u) => u.tag === component && (isDarkGround(u) || drawnInDarkGround(u, all, depth + 1)))
}

// ── The checks ─────────────────────────────────────────────────────────────

/** Opaque bg-white that is not a mat for an image or the QR code, or that holds text. */
function badMats(nodes: JsxNode[]): string[] {
  return nodes
    .filter((n) => tokens(n).some(({ token }) => token.utility === 'bg-white' && token.modifier === ''))
    .filter((n) => {
      const image =
        n.tag === 'img' ||
        descendants(n).some((d) => d.tag === 'img' || /backgroundImage/.test(d.style)) ||
        (n.innerHtml !== null && /qr/i.test(n.innerHtml))
      return !image || [n, ...descendants(n)].some((d) => d.text)
    })
    .map(where)
}

/** Translucent white veils that sit on no navy or dark ground. */
function offGroundVeils(nodes: JsxNode[]): string[] {
  return nodes.flatMap((n) =>
    tokens(n)
      .filter(({ token, piece }) => token.utility === 'bg-white' && token.modifier !== '' && !piece.conditions.includes(ON_NAVY) && !onDarkGround(n))
      .map(({ token }) => `${where(n)} ${token.text}`))
}

/**
 * text-brand-navy with no opaque gold fill under it. A ! mark on the gold
 * does not matter: it changes which rule wins, not the colour.
 */
function navyTextOffGold(nodes: JsxNode[]): string[] {
  const sites = map.sites.filter((s) => parseToken(s.to).utility === 'text-brand-navy')
  const out: string[] = []
  for (const n of nodes) {
    for (const { token, piece } of tokens(n).filter((x) => x.token.utility === 'text-brand-navy')) {
      const own = tokensOf(piece.text).some(({ token: g }) =>
        g.utility === 'bg-lca-gold' && g.modifier === '' && (g.variants === '' || g.variants === token.variants))
      const site = sites.some((s) => s.file === n.file && piece.text.includes(s.contains))
      const above = selfAndAncestors(n).slice(1).some((a) => tokens(a).some(({ token: g }) => g.utility === 'bg-lca-gold' && g.modifier === '' && g.variants === ''))
      if (!own && !(site && above)) out.push(`${where(n)} ${token.text}`)
    }
  }
  return out
}

/** bg- utilities that set something other than the colour. */
const NOT_COLOUR = /^bg-(cover|contain|center|top|bottom|left|right|no-repeat|repeat.*|fixed|local|scroll|clip-.*|origin-.*|blend-.*|none|auto|gradient-.*|linear-.*|radial.*|conic.*)$/

/** Another background colour that can apply with text-brand-navy and replace its gold. */
function goldReplaced(nodes: JsxNode[]): string[] {
  const out: string[] = []
  for (const n of nodes) {
    const all = tokens(n)
    for (const { token, piece } of all.filter((x) => x.token.utility === 'text-brand-navy')) {
      for (const other of all) {
        if (other.piece === piece || exclusive(other.piece, piece)) continue
        const t = other.token
        if (!t.utility.startsWith('bg-') || NOT_COLOUR.test(t.utility) || t.variants !== token.variants) continue
        if (t.utility === 'bg-lca-gold' && t.modifier === '') continue
        out.push(`${where(n)} ${t.text} beside ${token.text}`)
      }
    }
  }
  return out
}

/** Text colours that follow the look: navy or dark grey on the light grounds, light in dark mode, or the reverse. */
const LOOK_TEXT = /^text-(ink|foreground|primary-foreground|secondary-foreground|muted-foreground|card-foreground|popover-foreground|accent-foreground)$/
/** Text colours that stay light on navy in every look. */
const LIGHT_ON_NAVY = /^text-(white|lca-gold)$/
/** shadcn components whose default variant draws the label in text-primary-foreground on bg-primary. */
const PRIMARY_LABEL = new Set(['Button', 'Badge'])

/**
 * Text on a navy fill whose colour follows the look, so in dark mode or in
 * light mode it is dark on navy: a look-following text colour that can apply
 * with the fill (tailwind-merge settles one that comes before the fill's own
 * light colour in the same cn() call), or a Button or Badge whose className
 * gives the navy fill but leaves the variant's label colour.
 */
function lookTextOnNavy(nodes: JsxNode[]): string[] {
  const out: string[] = []
  for (const n of nodes) {
    n.pieces.forEach((p, i) => {
      const own = tokensOf(p.text).map(({ token }) => token)
      if (!own.some((t) => plain(t) && t.utility === 'bg-brand-navy')) return
      const ownLight = own.some((t) => t.variants === '' && LIGHT_ON_NAVY.test(t.utility))
      n.pieces.forEach((q, j) => {
        if (q !== p && exclusive(p, q)) return
        for (const { token } of tokensOf(q.text)) {
          if (token.variants !== '' || !LOOK_TEXT.test(token.utility)) continue
          if (q !== p && ownLight && merged(p, q) && j < i) continue
          out.push(`${where(n)} ${token.text} on bg-brand-navy`)
        }
      })
    })
    if (PRIMARY_LABEL.has(n.tag) && tokens(n).some(({ token }) => plain(token) && token.utility === 'bg-brand-navy')) {
      const label = tokens(n).some(({ token }) => token.utility === 'text-white' && token.modifier === '' && (token.variants === '' || token.variants === 'dark:'))
      if (!label) out.push(`${where(n)} the label is text-primary-foreground on bg-brand-navy`)
    }
  }
  return out
}

/** An inline navy ground holding a control, with no data-ground="dark" on it or above it. */
function unmarkedInlineNavy(nodes: JsxNode[]): string[] {
  return nodes
    .filter((n) => INLINE_NAVY.test(n.style) && holdsControl(n) && !selfAndAncestors(n).some((a) => a.ground === 'dark'))
    .map(where)
}

/** Grounds that are light in the light look; a card on one draws it under its controls. */
const LIGHT_GROUND = new Set(['bg-surface', 'bg-white', 'bg-card', 'bg-background', 'bg-popover', 'bg-muted', 'bg-lca-gold'])

/**
 * Light cards (not themselves controls) that hold a control inside a navy or
 * dark ground, in their own file or in any place their component is drawn.
 */
function lightCards(nodes: JsxNode[], all: JsxNode[] = ALL): JsxNode[] {
  return nodes
    .filter((n) => !FOCUSABLE.has(n.tag) && tokens(n).some(({ token }) => plain(token) && LIGHT_GROUND.has(token.utility)))
    .filter((n) => holdsControl(n) && drawnInDarkGround(n, all))
}
const lightCardsInBands = (nodes: JsxNode[], all: JsxNode[] = ALL): string[] => lightCards(nodes, all).map(where)

/**
 * Of those cards, the ones whose controls keep the band's gold ring: under
 * some ground the gold ring rule names, the rule that gives the look's own
 * ring (var(--focus)) back names none of the card's light grounds.
 */
function goldRingOnLight(cards: JsxNode[], css: CssRule[] = indexCssRules()): string[] {
  const gold = css.find((r) => r.decls.get('outline-color') === 'var(--gold-on-dark)')
  const back = css.find((r) => r.decls.get('outline-color') === 'var(--focus)')
  const ringBack = (ground: string) =>
    !!gold && gold.selectors.every((s) => !!back?.selectors.includes(s.replace(/ :focus-visible$/, ` .${ground} :focus-visible`)))
  return cards
    .filter((n) => !tokens(n).some(({ token }) => plain(token) && LIGHT_GROUND.has(token.utility) && ringBack(token.utility)))
    .map(where)
}

/** Fixed light tints: they do not follow the look, so words that do (light in dark mode) are light on light there. */
const FIXED_LIGHT = /^bg-((emerald|green|red|amber|yellow|orange|blue|sky|indigo|violet|purple|pink|rose|teal|cyan|lime|gray|slate|zinc|stone|neutral)-(50|100|200)|lca-cream|\[#[ef][0-9a-f]{5}\]|\[#fff\]|\[#ffffff\])$/

/** Every look the new look brings, light and dark, as the tokens a container in it sees. */
const LOOK_TOKENS = (() => {
  const rules = indexCssRules()
  return [false, true].flatMap((dark) => [
    rootTokens(rules, { look: true, dark }),
    ...['live', 'scholastic', 'heritage'].map((theme) => scopeTokens(rules, { look: true, dark }, theme)),
  ])
})()
const INLINE = indexCssRules().find((r) => r.selector === '@theme inline')!

/**
 * Whether a text or background colour utility follows the look: it reads a
 * token (through the @theme inline block) whose value is not the same in
 * every look and mode. text-ink, text-muted-foreground, text-ok and bg-muted
 * do; text-muted-on-light and bg-veil-on-light/30, which stay as the light look
 * draws them, do not, and neither do text-white or a brand or palette colour.
 */
function followsLook(utility: string): boolean {
  const m = utility.match(/^(?:text|bg)-(.+)$/)
  const token = m ? INLINE.decls.get(`--color-${m[1]}`)?.match(/^var\((--[\w-]+)\)$/)?.[1] : undefined
  return !!token && new Set(LOOK_TOKENS.map((t) => t.get(token))).size > 1
}
const wordsFollow = (t: ClassToken) => t.variants === '' && t.utility.startsWith('text-') && followsLook(t.utility)
/** An opaque ground that follows the look, which puts an element back on the look's own ground. */
const groundFollows = (t: ClassToken) => t.variants === '' && t.modifier === '' && t.utility.startsWith('bg-') && followsLook(t.utility)

/** Words that follow the look in the same className as a fixed light tint that can apply with them. */
function lookWordsBesideTint(nodes: JsxNode[]): string[] {
  const out: string[] = []
  for (const n of nodes) {
    const all = tokens(n)
    for (const words of all.filter(({ token }) => wordsFollow(token))) {
      for (const other of all) {
        if (other.piece !== words.piece && exclusive(other.piece, words.piece)) continue
        if (other.token.variants === '' && other.token.modifier === '' && FIXED_LIGHT.test(other.token.utility)) out.push(`${where(n)} ${words.token.text} on ${other.token.text}`)
      }
    }
  }
  return out
}

/**
 * The fixed light tint an element sits on, when no ground that follows the
 * look comes between: the first one up its ancestors (itself left out), or null.
 */
function islandAbove(n: JsxNode): string | null {
  for (const a of selfAndAncestors(n).slice(1)) {
    const t = tokens(a).filter(({ token }) => token.variants === '' && token.modifier === '')
    // A fixed tint in any branch of an ancestor: in that branch the element sits on it.
    const tint = t.find(({ token }) => FIXED_LIGHT.test(token.utility))
    if (tint) return tint.token.text
    // A ground that follows the look, between the element and any tint, is what it sits on.
    if (t.some(({ token }) => groundFollows(token))) return null
  }
  return null
}

/** Words that follow the look inside an element with a fixed light tint, with no ground that follows the look in between. */
function lookWordsOnIslands(nodes: JsxNode[]): string[] {
  const out: string[] = []
  for (const n of nodes) {
    const own = tokens(n).map(({ token }) => token)
    if (own.some(groundFollows)) continue
    const words = own.filter(wordsFollow)
    const island = words.length > 0 ? islandAbove(n) : null
    if (island) out.push(`${where(n)} ${words.map((w) => w.text).join(' ')} on ${island}`)
  }
  return out
}

/** A translucent ground that follows the look, laid over a fixed light tint: in dark mode it darkens the island under it. */
function lookVeilsOnIslands(nodes: JsxNode[]): string[] {
  const out: string[] = []
  for (const n of nodes) {
    const veils = tokens(n).filter(({ token }) => token.variants === '' && token.modifier !== '' && token.utility.startsWith('bg-') && followsLook(token.utility))
    const island = veils.length > 0 ? islandAbove(n) : null
    if (island) out.push(`${where(n)} ${veils.map((v) => v.token.text).join(' ')} on ${island}`)
  }
  return out
}

// ── Each check on a planted file ───────────────────────────────────────────

describe('each check finds what it looks for', () => {
  const planted = (body: string) =>
    jsxTree('src/pages/Planted.tsx', [
      "import { LCA } from '@/lib/brand'",
      'export function Planted() {',
      `  return (${body})`,
      '}',
    ].join('\n'))

  it('a white mat with words on it, and one with no image', () => {
    expect(badMats(planted('<div><img className="bg-white" alt="" /><div className="bg-white"><img alt="" /></div></div>'))).toEqual([])
    expect(badMats(planted('<div className="bg-white"><img alt="" /><p>Words</p></div>'))).toHaveLength(1)
    expect(badMats(planted('<div className="rounded bg-white p-2" />'))).toHaveLength(1)
  })

  it('a white veil on a light card', () => {
    expect(offGroundVeils(planted('<div className="bg-card"><span className="bg-white/10">x</span></div>'))).toHaveLength(1)
    expect(offGroundVeils(planted('<div className="bg-brand-navy"><span className="bg-white/10">x</span></div>'))).toEqual([])
    expect(offGroundVeils(planted('<div data-ground="dark"><span className="hover:bg-white/20">x</span></div>'))).toEqual([])
  })

  it('navy text with no gold under it, and gold a later class can replace', () => {
    expect(navyTextOffGold(planted('<p className="bg-muted text-brand-navy">x</p>'))).toHaveLength(1)
    expect(navyTextOffGold(planted('<p className="bg-lca-gold/20 text-brand-navy">x</p>'))).toHaveLength(1)
    expect(navyTextOffGold(planted('<p className="bg-lca-gold text-brand-navy">x</p>'))).toEqual([])
    // An important gold is still gold. The ! is joined on when the test runs,
    // so Tailwind, which reads this file for class names, builds no CSS for it.
    expect(navyTextOffGold(planted(`<p className="${'!'}bg-lca-gold text-brand-navy">x</p>`))).toEqual([])
    expect(goldReplaced(planted("<p className={cn('bg-lca-gold text-brand-navy', on && 'bg-muted')}>x</p>"))).toHaveLength(1)
    expect(goldReplaced(planted("<p className={on ? 'bg-lca-gold text-brand-navy' : 'bg-muted text-ink'}>x</p>"))).toEqual([])
  })

  it('text on a navy fill that follows the look, and a navy Button that keeps its variant label', () => {
    expect(lookTextOnNavy(planted('<p className="bg-brand-navy text-ink">x</p>'))).toHaveLength(1)
    expect(lookTextOnNavy(planted("<p className={on ? 'bg-brand-navy text-white' : 'text-muted-foreground'}>x</p>"))).toEqual([])
    expect(lookTextOnNavy(planted("<p className={cn('text-ink', on && 'bg-brand-navy text-white')}>x</p>"))).toEqual([])
    expect(lookTextOnNavy(planted("<p className={cn('bg-brand-navy text-white', on && 'text-ink')}>x</p>"))).toHaveLength(1)
    expect(lookTextOnNavy(planted('<Button className="bg-brand-navy hover:bg-brand-navy/90">Send</Button>'))).toHaveLength(1)
    expect(lookTextOnNavy(planted('<Button className="bg-brand-navy hover:bg-brand-navy/90 dark:text-white">Send</Button>'))).toEqual([])
  })

  it('an inline navy ground with a link and no marker', () => {
    expect(unmarkedInlineNavy(planted('<section style={{ backgroundColor: LCA.navy }}><a href="/">x</a></section>'))).toHaveLength(1)
    expect(unmarkedInlineNavy(planted('<section style={{ backgroundColor: LCA.navy }} data-ground="dark"><a href="/">x</a></section>'))).toEqual([])
    expect(unmarkedInlineNavy(planted('<section style={{ backgroundColor: LCA.navy }}><h2>x</h2></section>'))).toEqual([])
  })

  it('a light card with a button inside a navy band, in its own file or where its component is drawn', () => {
    expect(lightCardsInBands(planted('<div className="bg-brand-navy"><div className="bg-card"><button>x</button></div></div>'))).toHaveLength(1)
    expect(lightCardsInBands(planted('<div className="bg-brand-navy"><Button className="bg-lca-gold">x</Button></div>'))).toEqual([])
    // A dialog or a select list is drawn at the end of the page, outside the band.
    expect(lightCardsInBands(planted('<div className="bg-brand-navy"><DialogContent className="bg-card"><button>x</button></DialogContent></div>'))).toEqual([])
    // A menu drawn by another component: found through the place it is drawn, inside a hero or only on light grounds.
    const menu = jsxTree('src/components/PlantedMenu.tsx', [
      'export function PlantedMenu() {',
      '  return (<div className="relative"><button>Open</button><div className="bg-popover"><button>x</button></div></div>)',
      '}',
    ].join('\n'))
    const inHero = planted('<PageHero title="x"><div className="flex"><PlantedMenu /></div></PageHero>')
    const onLight = planted('<div className="bg-card"><PlantedMenu /></div>')
    expect(lightCardsInBands(menu, [...menu, ...inHero])).toEqual(['src/components/PlantedMenu.tsx:2 <div>'])
    expect(lightCardsInBands(menu, [...menu, ...onLight])).toEqual([])
    expect(lightCardsInBands(menu, [...menu, ...onLight, ...inHero])).toHaveLength(1)
  })

  it('a light card in a band whose controls keep the gold ring, unless the ring rules give the look\'s own ring back for its ground', () => {
    const css = (...extra: string[]) => parseRules([
      ':root[data-look="new"] .bg-brand-navy :focus-visible, :root[data-look="new"] [data-ground="dark"] :focus-visible { outline-color: var(--gold-on-dark); }',
      ...extra,
    ].join('\n'))
    const back = ':root[data-look="new"] .bg-brand-navy .bg-popover :focus-visible, :root[data-look="new"] [data-ground="dark"] .bg-popover :focus-visible { outline-color: var(--focus); }'
    const menu = lightCards(planted('<div className="bg-brand-navy"><div className="bg-popover"><button>x</button></div></div>'))
    const card = lightCards(planted('<div className="bg-brand-navy"><div className="bg-card"><button>x</button></div></div>'))
    expect(goldRingOnLight(menu, css(back))).toEqual([])
    expect(goldRingOnLight(menu, css())).toHaveLength(1)
    expect(goldRingOnLight(card, css(back))).toHaveLength(1)
    // The ring must come back under every ground the gold rule names.
    expect(goldRingOnLight(menu, css(back.slice(0, back.indexOf(',')) + ' { outline-color: var(--focus); }'))).toHaveLength(1)
  })

  it('words that follow the look on a fixed light tint, beside it or inside it', () => {
    expect(lookWordsBesideTint(planted('<p className="bg-emerald-50 text-ink">x</p>'))).toHaveLength(1)
    expect(lookWordsBesideTint(planted("<p className={on ? 'bg-emerald-50 text-emerald-800' : 'bg-lca-gold/20 text-ink'}>x</p>"))).toEqual([])
    expect(lookWordsOnIslands(planted('<div className="bg-emerald-50"><p className="text-ink">x</p></div>'))).toHaveLength(1)
    expect(lookWordsOnIslands(planted('<div className="bg-emerald-50"><div className="bg-card"><p className="text-ink">x</p></div></div>'))).toEqual([])
    // Any words colour that follows the look, read from the stylesheet: muted words and a tone's words too.
    expect(lookWordsOnIslands(planted('<div className="bg-[#f2efe6]"><p className="text-muted-foreground">x</p></div>'))).toHaveLength(1)
    expect(lookWordsOnIslands(planted('<div className="bg-[#f2efe6]"><p className="text-ok-700">x</p></div>'))).toHaveLength(1)
    expect(lookWordsBesideTint(planted('<p className="bg-[#f2efe6] text-muted-foreground">x</p>'))).toHaveLength(1)
    // Words that stay as the light look draws them, or that never follow a look, are not.
    expect(lookWordsOnIslands(planted('<div className="bg-[#f2efe6]"><p className="text-muted-on-light">x</p></div>'))).toEqual([])
    expect(lookWordsOnIslands(planted('<div className="bg-[#f2efe6]"><p className="text-white">x</p></div>'))).toEqual([])
    // A translucent ground does not end the island; an opaque one that follows the look does.
    expect(lookWordsOnIslands(planted('<div className="bg-[#f2efe6]"><div className="bg-muted/30"><p className="text-muted-foreground">x</p></div></div>'))).toHaveLength(1)
    expect(lookWordsOnIslands(planted('<div className="bg-[#f2efe6]"><button className="bg-surface text-ink">x</button></div>'))).toEqual([])
  })

  it('a veil that follows the look over a fixed light tint', () => {
    expect(lookVeilsOnIslands(planted('<div className="bg-[#f2efe6]"><div className="bg-muted/30"><p className="text-muted-on-light">x</p></div></div>'))).toHaveLength(1)
    expect(lookVeilsOnIslands(planted('<div className="bg-[#f2efe6]"><div className="bg-veil-on-light/30"><p className="text-muted-on-light">x</p></div></div>'))).toEqual([])
    expect(lookVeilsOnIslands(planted('<div className="bg-card"><div className="bg-muted/30">x</div></div>'))).toEqual([])
  })

  it('reads from the stylesheet which colours follow the look', () => {
    for (const u of ['text-ink', 'text-muted-foreground', 'text-foreground', 'text-ok', 'text-ok-700', 'text-status-open', 'bg-muted', 'bg-card', 'bg-ok-50']) expect(followsLook(u), u).toBe(true)
    // The veil as the clubs map writes it, and a hex colour put together when the test runs, so Tailwind, which reads this file, builds no CSS for it.
    const fixed = ['text-muted-on-light', parseToken('bg-veil-on-light/30').utility, 'text-white', 'text-brand-navy', 'bg-brand-navy', 'text-lca-gold', 'text-gold-on-dark', 'bg-ok-fill', ['text-[#', '123456]'].join('')]
    for (const u of fixed) expect(followsLook(u), u).toBe(false)
  })
})

// ── The files ──────────────────────────────────────────────────────────────

describe('the white left in the files', () => {
  it('each opaque bg-white is a white mat for a logo or the QR code, and holds no text', () => {
    const mats = ALL.filter((n) => tokens(n).some(({ token }) => token.utility === 'bg-white' && token.modifier === ''))
    expect(mats).toHaveLength(map.keep.filter((k) => k.file).length)
    expect(badMats(ALL)).toEqual([])
  })

  it('each translucent white veil sits on a navy or dark ground, here, wherever its component is drawn, or in its on="navy" branch', () => {
    const veils = ALL.flatMap((n) => tokens(n).filter(({ token }) => token.utility === 'bg-white' && token.modifier !== ''))
    expect(veils.length).toBeGreaterThanOrEqual(30)
    expect(offGroundVeils(ALL)).toEqual([])
  })

  it('every caller that tells a component it is on navy draws it on a navy or dark ground', () => {
    const lines = (n: JsxNode) => read(n.file).split('\n').slice(n.line - 1, n.line + 12).join('\n')
    const callers = ALL.filter((n) => /^(FilterDropdown|MultiSelectDropdown)$/.test(n.tag) && lines(n).includes('on="navy"'))
    expect(callers.length).toBeGreaterThan(0)
    expect(callers.filter((n) => !onDarkGround(n)).map(where)).toEqual([])
  })

  it('PageHero, which the veils in hero asides count as navy, draws a bg-brand-navy section', () => {
    const roots = jsxTree('src/components/PageHero.tsx').filter((n) => n.parent === null && n.component === 'PageHero')
    expect(roots).toHaveLength(1)
    expect(roots[0].tag).toBe('section')
    expect(tokens(roots[0]).some(({ token }) => plain(token) && token.utility === 'bg-brand-navy')).toBe(true)
  })
})

describe('navy text that stays navy', () => {
  it('sits on an opaque gold fill: in its own class string, or above it for the one site the map names', () => {
    expect(ALL.filter((n) => tokens(n).some(({ token }) => token.utility === 'text-brand-navy')).length).toBeGreaterThan(40)
    expect(navyTextOffGold(ALL)).toEqual([])
  })

  it('no other background colour in the same className can apply with it and replace the gold', () => {
    expect(goldReplaced(ALL)).toEqual([])
  })
})

describe('text on a navy fill', () => {
  it('stays light in dark mode: no look-following text colour applies with the fill, and each navy Button names its label colour', () => {
    expect(ALL.filter((n) => tokens(n).some(({ token }) => plain(token) && token.utility === 'bg-brand-navy')).length).toBeGreaterThan(70)
    expect(lookTextOnNavy(ALL)).toEqual([])
    // The three shadcn Buttons filled navy by their className, on /support and the admin support screen.
    const buttons = ALL.filter((n) => PRIMARY_LABEL.has(n.tag) && tokens(n).some(({ token }) => plain(token) && token.utility === 'bg-brand-navy'))
    expect(buttons.map((n) => n.file).sort()).toEqual(['src/pages/AdminSupportPage.tsx', 'src/pages/SupportPage.tsx', 'src/pages/SupportPage.tsx'])
  })
})

describe('dark grounds and the focus ring', () => {
  it('a navy ground drawn with an inline style that holds a control carries data-ground="dark"', () => {
    const inline = ALL.filter((n) => INLINE_NAVY.test(n.style))
    expect(inline.length).toBeGreaterThanOrEqual(3)
    expect(unmarkedInlineNavy(ALL)).toEqual([])
    // The two club heroes are the ones that hold controls.
    expect(inline.filter(holdsControl).map((n) => n.file).sort()).toEqual(['src/pages/AdminClubPage.tsx', 'src/pages/ClubDetailPage.tsx'])
  })

  it('data-ground="dark" sits only on dark grounds: an inline navy, the darkened hero photo, the dark announcement tones', () => {
    const marked = ALL.filter((n) => n.ground !== null)
    for (const n of marked) {
      if (INLINE_NAVY.test(n.style)) continue
      if (n.file === 'src/pages/HomePage.tsx') {
        // The slideshow: photos under a navy veil the map keeps navy.
        expect(descendants(n).some((d) => tokens(d).some(({ token }) => token.text === 'bg-brand-navy/55')), where(n)).toBe(true)
        continue
      }
      expect(n.file, where(n)).toBe('src/components/AnnouncementBanner.tsx')
    }
    expect(marked.map((n) => n.file).sort()).toEqual([
      'src/components/AnnouncementBanner.tsx',
      'src/pages/AdminClubPage.tsx',
      'src/pages/ClubDetailPage.tsx',
      'src/pages/HomePage.tsx',
    ])
  })

  it('the announcement tones marked dark are dark grounds for white text, and the others are not marked', () => {
    const source = read('src/components/AnnouncementBanner.tsx')
    const marked = source.match(/DARK_GROUND_TONES = new Set\(\[([^\]]*)\]\)/)?.[1].match(/'(\w+)'/g)?.map((s) => s.slice(1, -1))
    expect(marked).toEqual(['urgent', 'info'])
    for (const tone of marked!) {
      const hex = source.match(new RegExp(`${tone}: 'bg-\\[(#[0-9a-f]{6})\\] text-white'`))?.[1]
      expect(hex, tone).toBeDefined()
      expect(contrast(hex!, '#ffffff'), tone).toBeGreaterThanOrEqual(4.5)
    }
    // The navy tone is a bg-brand-navy box, which the ring rule covers, and gold is a light ground.
    expect(source).toContain("navy: 'bg-brand-navy text-white'")
    expect(source).toContain("gold: 'bg-lca-gold text-brand-navy'")
  })

  it('the gold ring rule names every navy ground class the files use', () => {
    const grounds = new Set(ALL.flatMap((n) => tokens(n).filter(({ token }) => plain(token) && /^bg-(brand|lca)-navy$/.test(token.utility)).map(({ token }) => token.utility)))
    expect([...grounds]).toEqual(['bg-brand-navy'])
    const gold = indexCssRules().find((r) => r.decls.get('outline-color') === 'var(--gold-on-dark)')!
    for (const g of grounds) expect(gold.selectors).toContain(`:root[data-look="new"] .${g} :focus-visible`)
    expect(gold.selectors).toContain(':root[data-look="new"] [data-ground="dark"] :focus-visible')
  })

  it('a light card that holds a control inside a navy band, here or where its component is drawn, gets the look\'s own ring back', () => {
    // The one: the menu the state filter in the /tournaments hero opens (FilterDropdown, drawn inside PageHero).
    const cards = lightCards(ALL)
    expect(cards.map((n) => `${n.file} <${n.tag}>`)).toEqual(['src/components/FilterDropdown.tsx <div>'])
    expect(cards[0].classes).toContain('bg-popover')
    expect(goldRingOnLight(cards)).toEqual([])
  })
})

describe('words on a ground that stays light in dark mode', () => {
  it('words that follow the look never share a className with a fixed light tint that can apply with them', () => {
    expect(lookWordsBesideTint(ALL)).toEqual([])
  })

  it('sits inside one nowhere: the two light islands step 23 recorded now sit on the ok tint, which follows the look', () => {
    // Step 23 left the member strip on /membership and the finished-event
    // panel on the manage page as fixed light tints (bg-emerald-50) under
    // text-ink; step 24 moved both tints to bg-ok-50, which turns dark in dark mode.
    expect(lookWordsOnIslands(ALL)).toEqual([])
    const islands = ALL.filter((n) =>
      ['src/pages/MembershipPage.tsx', 'src/pages/TournamentManagePage.tsx'].includes(n.file) &&
      n.classes.includes('bg-ok-50') &&
      descendants(n).some((d) => d.classes.includes('text-ink')))
    expect(islands.map((n) => n.file).sort()).toEqual(['src/pages/MembershipPage.tsx', 'src/pages/TournamentManagePage.tsx'])
    const status = read('REDESIGN_STATUS.md')
    expect(status).toMatch(/- \*\*Light islands that stay light in dark mode \(step 23\)\.\*\* .*`\/membership`.*manage page/)
  })

  it('no veil that follows the look lies over one, and the club map\'s paper keeps its loading note as the light look draws it', () => {
    expect(lookVeilsOnIslands(ALL)).toEqual([])
    // The paper stays light in every look (the raw colour allowlist), so the
    // words on it while the map loads, and the veil over them on the clubs
    // map, take text-muted-on-light and bg-veil-on-light/30.
    const paper = ALL.filter((n) => n.classes.includes('bg-[#f2efe6]'))
    expect(paper.map((n) => n.file).sort()).toEqual(['src/areas/clubs/components/ClubLocationPicker.tsx', 'src/areas/clubs/components/LCAMap.tsx'])
    const notes = paper.flatMap((n) => descendants(n)).filter((d) => d.text && d.classes.includes('text-muted-on-light'))
    expect(notes.map((d) => d.file).sort()).toEqual(['src/areas/clubs/components/ClubLocationPicker.tsx', 'src/areas/clubs/components/LCAMap.tsx'])
  })
})
