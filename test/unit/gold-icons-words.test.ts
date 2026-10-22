// test/unit/gold-icons-words.test.ts
//
// Nothing relies on gold alone (WS01 step 25). Step 25 moved every gold
// text class on a light ground to text-gold-ink, and every one of them was
// an icon: a pin, a map marker, a calendar, a person, a trophy and the like.
// An icon in a colour is not a status in words, so each must sit beside
// words that say what it marks, in a colour of their own. This reads every
// text-gold-ink in the TSX files with the reader of
// test/unit/helpers/jsxClasses.ts and holds that:
// - each is on an icon (a lucide-react icon the file imports, or an icon
//   held in a variable or prop), except the word "Pinned" the News page
//   draws beside its pin under the new look;
// - each icon has words beside it, outside the icon itself: in the element
//   that holds it (78 of the 80 icons) or in the element around that (the
//   scanner's sign-in and camera cards), never past the component it is
//   drawn in;
// - the News page's pin is the one icon whose meaning was its colour and a
//   name for screen readers only, and under the new look it carries the word.
// The gold "State champions" link on the /tournaments hero, which colour
// alone set apart from the words around it until hovered, keeps its line as
// it is, and with newLook off it is today's; under the new look a rule in
// src/index.css underlines it (step 32). Both are pinned here, so a change
// to either means updating this test and the record together
// (REDESIGN_STATUS.md, Follow-ups).
import { describe, expect, it } from 'vitest'
import { tokensOf, tsxFiles } from '../../scripts/codemods/semantic-colours'
import { read, ROOT } from './helpers/cssTokens'
import { jsxTree, type JsxNode } from './helpers/jsxClasses'

/** The icon components a file can draw: the names it imports from lucide-react, and an icon held in a variable or a prop. */
function iconNames(source: string): Set<string> {
  const names = new Set<string>()
  for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/g)) for (const n of m[1].split(',')) if (n.trim()) names.add(n.trim().split(/\s+as\s+/).pop()!)
  return names
}
const isIcon = (node: JsxNode, icons: Set<string>) => icons.has(node.tag) || /(?:^|\.)icon$/i.test(node.tag) || /Icon$/.test(node.tag)

/** Whether an element, or anything inside it, puts words on the page. */
const hasWords = (node: JsxNode): boolean => node.text || node.children.some(hasWords)

/** The words beside an icon: its holder, or the holder's holder, within its component, with words outside the icon. */
function wordsBeside(icon: JsxNode): JsxNode | null {
  let inner: JsxNode = icon
  for (let level = 0, holder = icon.parent; holder && level < 2; level++, inner = holder, holder = holder.parent) {
    if (holder.component !== icon.component) break
    if (holder.text || holder.children.some((c) => c !== inner && hasWords(c))) return holder
  }
  return null
}

interface GoldInkUse {
  where: string
  node: JsxNode
  icon: boolean
}

const uses: GoldInkUse[] = tsxFiles(ROOT).flatMap((file) => {
  const icons = iconNames(read(file))
  return jsxTree(file)
    .filter((n) => n.pieces.some((p) => tokensOf(p.text).some(({ token }) => token.utility === 'text-gold-ink' && token.variants === '')))
    .map((n) => ({ where: `${file}:${n.line} <${n.tag}>`, node: n, icon: isIcon(n, icons) }))
})

describe('every gold-ink mark on a light ground sits beside words (step 25)', () => {
  it('finds the uses: the icons step 25 moved, and the word "Pinned" beside the News page\'s pin', () => {
    // 82 classes were rewritten, 2 of them in commented-out code, which draws nothing: 80 icons are drawn, and the word.
    expect(uses.filter((u) => u.icon)).toHaveLength(80)
    expect(uses.filter((u) => !u.icon).map((u) => u.where)).toEqual([expect.stringMatching(/^src\/pages\/NewsPage\.tsx:\d+ <span>$/)])
    const word = uses.find((u) => !u.icon)!.node
    expect(hasWords(word)).toBe(true)
  })

  it('each icon has words beside it, so its gold is never the only sign of what it marks', () => {
    expect(uses.filter((u) => u.icon && !wordsBeside(u.node)).map((u) => u.where)).toEqual([])
  })

  it('reads words beside an icon, and finds none beside a bare one', () => {
    const page = (body: string) => jsxTree('src/pages/Planted.tsx', `import { Pin, Trophy } from 'lucide-react'\nexport function Planted({ n }: { n: number }) {\n  return (\n    <main>\n      ${body}\n    </main>\n  )\n}\n`)
    const iconIn = (nodes: JsxNode[]) => nodes.find((n) => n.tag === 'Pin' || n.tag === 'Trophy')!
    expect(wordsBeside(iconIn(page('<h2><Trophy className="text-gold-ink" /> Champions</h2>')))).not.toBeNull()
    expect(wordsBeside(iconIn(page('<div><Trophy className="text-gold-ink" /><p>Champions</p></div>')))).not.toBeNull()
    expect(wordsBeside(iconIn(page('<p><Pin className="text-gold-ink" />{n}</p>')))).not.toBeNull()
    expect(wordsBeside(iconIn(page('<div><div><Pin className="text-gold-ink" /></div></div>')))).toBeNull()
    // Words three levels up are not beside the icon.
    expect(wordsBeside(iconIn(page('<section><div><div><Pin className="text-gold-ink" /></div></div><p>Elsewhere</p></section>')))).toBeNull()
    expect(wordsBeside(iconIn(page('<p><Pin className="text-gold-ink" aria-label="Pinned" /></p>')))).toBeNull()
  })
})

describe('the pins on the news pages', () => {
  it('the News page marks a pinned post with the word under the new look, and with the icon\'s name alone without it', () => {
    const news = read('src/pages/NewsPage.tsx')
    expect(news).toMatch(/FEATURES\.newLook \? \(\s*<span className="[^"]*text-gold-ink[^"]*">\s*<Pin className="size-3" aria-hidden="true" \/>\s*Pinned\s*<\/span>/)
    expect(news).toContain('<Pin className="size-3 text-gold-ink" aria-label="Pinned" />')
  })

  it('the post page on its navy hero already says Pinned in words, and keeps brand gold there', () => {
    const post = read('src/pages/NewsPostPage.tsx')
    expect(post).toMatch(/<Pin className="size-3\.5 text-lca-gold" \/> Pinned<\/span>/)
  })

  it('the admin list of posts keeps its pin with its name, the decision step 25 records for WS10 to revisit', () => {
    const panel = read('src/areas/admin/components/PostsPanel.tsx')
    expect(panel).toMatch(/<Pin className="[^"]*text-gold-ink[^"]*" aria-label="Pinned" \/>/)
    expect(read('REDESIGN_STATUS.md')).toContain('- **The pin in the admin list of posts (step 25).**')
  })
})

describe('the State champions link (step 25, underlined under the new look in step 32)', () => {
  // Brand gold on the navy hero at 6.51:1, set apart from the white words
  // around it by its colour until hovered, which the accessibility checker's
  // link-in-text-block finds. With newLook off it is today's link, underlined
  // on hover only; under the new look a rule underlines a brand gold link
  // that is a paragraph's own (PageHero draws the subtitle as a paragraph),
  // and test/a11y/scopes.spec.ts finds no link-in-text-block on the page.
  it('is brand gold on the /tournaments hero, underlined on hover with newLook off and always under the new look', () => {
    const page = read('src/pages/TournamentsPage.tsx')
    expect(page).toContain('<Link to="/champions" className="text-lca-gold hover:underline">State champions →</Link>')
    const css = read('src/index.css')
    expect(css).toMatch(/:root\[data-look="new"\] p > a\.text-lca-gold \{\s*text-decoration-line: underline;\s*\}/)
    const status = read('REDESIGN_STATUS.md')
    expect(status).toContain('- **The State champions link (step 25; older than the step).**')
    expect(status).toContain('Nothing relies on colour alone')
  })
})
