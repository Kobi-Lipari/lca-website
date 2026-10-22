// test/unit/gold-ink.test.ts
//
// scripts/codemods/gold-ink.ts on small planted trees and on the real one
// (WS01 step 25). The script reads the ground of every text-lca-gold class
// and rewrites those on a light ground to text-gold-ink. These tests hold:
// - what it reads as navy: an opaque bg-brand-navy or bg-lca-navy, an inline
//   navy (LCA.navy, a NAVY constant, the literal), data-ground="dark" beside
//   a navy of its own, a hex ground on which brand gold reads 4.5:1, anything
//   passed to PageHero, a component drawn only on navy, and a navy that
//   applies in the same branch as the gold;
// - what it reads as light: a card, the page, a gold tint over a card, an
//   inline tint over a card (a colour given two hex digits of alpha), a hex
//   ground on which the light look's dark gold reads 4.5:1, an outline
//   Button, a Card, what a dialog draws, unless the Card or the dialog is
//   given a navy ground of its own;
// - how it follows a component to where it is drawn: under another name, as
//   a default export, through a namespace or lazy(), made with forwardRef()
//   or memo(), and never by a component of the same name from another
//   module;
// - how it reads a component of the tree among the ancestors: the ground it
//   paints where its children or a prop it draws land, the caller's classes
//   where it takes its className, a gold class passed as its className, a
//   component that paints nothing there (the walk goes on to the caller's
//   ground), one that paints two kinds of ground, and one that draws itself;
// - what it leaves to a person: a string no className reads, a ground that
//   may or may not apply with the gold, a ground it does not know, an inline
//   ground it cannot read, a ground marked data-ground="dark" with no navy
//   of its own (the home page hero's darkened photo), a hex ground on which
//   neither gold reads 4.5:1 (the urgent banner's red, Facebook's blue, a mid
//   grey), a component drawn on both kinds of ground, and commented-out code
//   that names a navy ground before the class;
// - that a rewrite keeps variants, the opacity modifier and the ! mark, that
//   commented-out code on a light ground is rewritten, that a class joined to
//   a ${} or in a string with an escape stops the run, that text-gold-ink on
//   navy or on a ground the script cannot place is a problem, and how
//   allowlist entries are counted;
// - the command line: --check, --dry-run, --table, the usage errors, a real
//   run and a second run that rewrites nothing, and --check on the real tree.
// Class names are put together when the test runs, so Tailwind, which reads
// this file, builds no CSS for them.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { GOLD_INK, planGold, reviewTable } from '../../scripts/codemods/gold-ink'
import type { GoldAllowEntry } from './fixtures/goldAllowlist'
import { GOLD_ALLOWLIST } from './fixtures/goldAllowlist'
import { ROOT } from './helpers/cssTokens'

const c = (...parts: string[]) => parts.join('')
const GOLD = c('text-lca', '-gold')

const work = mkdtempSync(join(tmpdir(), 'gold-ink-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))
let n = 0

function tree(files: Record<string, string>): string {
  const root = join(work, `t${n++}`)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return root
}

/** A page with one body; `head` goes above it. */
const page = (body: string, head = '') => `import { LCA } from '@/lib/brand'\nconst NAVY = LCA.navy\n${head}\nexport function Planted({ on }: { on: boolean }) {\n  return (\n    <main>\n${body}\n    </main>\n  )\n}\n`

/** The home page hero's shape: data-ground="dark" on the outer element, the darkened photo and its navy veil as siblings of the words. */
const hero = (cls: string) => [
  '      <div className="relative overflow-hidden" style={{ height: 420 }} data-ground="dark">',
  "        <div className=\"absolute inset-0 bg-cover bg-center\" style={{ backgroundImage: 'url(/hero.jpg)', filter: 'brightness(0.55)' }} />",
  '        <div className="absolute inset-0 bg-brand-navy/55 mix-blend-multiply" />',
  '        <div className="absolute inset-0 flex flex-col items-center justify-end text-white">',
  `          <p className="text-sm ${cls}">Louisiana's chess community since 1915</p>`,
  '        </div>',
  '      </div>',
].join('\n')

/** A hex ground class, put together when the test runs. */
const hexBg = (hex: string) => c('bg-[#', hex, ']')

/** The plan for one planted page: what is rewritten, what is kept, and the problems. */
function planFor(body: string, head = '', allowlist: GoldAllowEntry[] = [], extra: Record<string, string> = {}) {
  const root = tree({ 'src/pages/Planted.tsx': page(body, head), ...extra })
  const plan = planGold(root, allowlist, 'write')
  return {
    root,
    plan,
    rewrites: plan.rewrites.map((r) => `${r.use.token} -> ${r.to}`),
    grounds: plan.uses.map((u) => u.ground),
    whys: plan.uses.map((u) => u.why),
    problems: plan.problems.map((p) => p.message),
    after: plan.contents.get('src/pages/Planted.tsx') ?? '',
  }
}

describe('the grounds the script reads as navy, which keep brand gold', () => {
  it.each([
    ['an opaque bg-brand-navy', `<section className="bg-brand-navy"><p className="${GOLD}">x</p></section>`],
    ['the old bg-lca-navy', `<section className="${c('bg-lca', '-navy')}"><p className="${GOLD}">x</p></section>`],
    ['a navy in the gold\'s own string', `<p className="bg-brand-navy ${GOLD}">x</p>`],
    ['an inline LCA.navy', `<section style={{ backgroundColor: LCA.navy }}><p className="${GOLD}">x</p></section>`],
    ['an inline NAVY constant', `<section style={{ backgroundColor: NAVY }}><p className="${GOLD}">x</p></section>`],
    ['an inline navy literal', `<section style={{ backgroundColor: '#1a2744' }}><p className="${GOLD}">x</p></section>`],
    ['data-ground="dark" beside an inline navy, as the club heroes draw it', `<section style={{ backgroundColor: LCA.navy }} data-ground="dark"><p className="${GOLD}">x</p></section>`],
    ['data-ground="dark" on a navy fill', `<div className="bg-brand-navy" data-ground="dark"><p className="${GOLD}">x</p></div>`],
    ['a hex ground on which brand gold reads 4.5:1 (7.64:1 on the dark look\'s ground)', `<div className="${hexBg('111a2c')}"><p className="${GOLD}">x</p></div>`],
    ['PageHero, through a prop', `<PageHero title="x" meta={<span className="${GOLD}">y</span>} />`],
    ['a white veil over navy', `<section className="bg-brand-navy"><a className="${c('bg-', 'white/5')}"><span className="${GOLD}">x</span></a></section>`],
    ['a navy in the branch the gold applies in', `<a className={on ? 'bg-brand-navy text-white' : 'text-muted-foreground'}><span className={on && '${GOLD}'}>x</span></a>`],
  ])('%s', (_, body) => {
    const r = planFor(`      ${body}`)
    expect(r.grounds).toEqual(['navy'])
    expect(r.rewrites).toEqual([])
    expect(r.problems).toEqual([])
  })

  it('a component drawn only on navy, in its own file or in a file that imports it', () => {
    const head = `function Item() {\n  return <a className="${GOLD}">x</a>\n}`
    expect(planFor('      <nav className="bg-brand-navy"><Item /><Item /></nav>', head).grounds).toEqual(['navy'])
    const label = `export function Label() {\n  return <span className="${GOLD}">x</span>\n}\n`
    const user = page('      <section className="bg-brand-navy"><Label /></section>', "import { Label } from '@/components/Label'")
    const plan = planGold(tree({ 'src/components/Label.tsx': label, 'src/pages/User.tsx': user }), [], 'write')
    expect(plan.uses.map((u) => [u.file, u.ground])).toEqual([['src/components/Label.tsx', 'navy']])
    expect(plan.uses[0].why).toContain('src/pages/User.tsx line')
  })
})

describe('the grounds the script reads as light, which take text-gold-ink', () => {
  it.each([
    ['a card', `<div className="bg-card"><p className="${GOLD}">x</p></div>`],
    ['the page itself', `<p className="${GOLD}">x</p>`],
    ['a gold tint over a card', `<div className="bg-card"><p className="bg-lca-gold/20 ${GOLD}">x</p></div>`],
    ['a card inside a navy band, which is the nearer ground', `<section className="bg-brand-navy"><div className="bg-popover"><p className="${GOLD}">x</p></div></section>`],
    ['an outline Button', `<section className="bg-brand-navy"><Button variant="outline"><Bell className="${GOLD}" /> Notify me</Button></section>`],
    ['a Card', `<section className="bg-brand-navy"><Card><p className="${GOLD}">x</p></Card></section>`],
    ['what a dialog draws, wherever it is drawn from', `<section className="bg-brand-navy"><DialogContent><p className="${GOLD}">x</p></DialogContent></section>`],
    ['a hover ground, which is not the resting ground', `<div className="${c('hover:', 'bg-brand-navy')}"><p className="${GOLD}">x</p></div>`],
    ['a hex ground on which the light look\'s dark gold reads 4.5:1 (4.91:1 on the phone sheet\'s row)', `<div className="${hexBg('fbfaf6')}"><p className="${GOLD}">x</p></div>`],
    ['an inline tint given as a colour and two hex digits of alpha, as the admin\'s colour preview draws it, over a card', '<div className="bg-card"><div style={{ backgroundColor: `${color}15` }}><p className="' + GOLD + '">x</p></div></div>'],
  ])('%s', (_, body) => {
    const r = planFor(`      ${body}`)
    expect(r.grounds).toEqual(['light'])
    expect(r.rewrites).toEqual([`${GOLD} -> ${GOLD_INK}`])
    expect(r.problems).toEqual([])
    expect(r.after).toContain(GOLD_INK)
    expect(r.after).not.toContain(GOLD)
  })

  it('keeps the variants, the opacity modifier and the ! mark', () => {
    const r = planFor(`      <p className="hover:${GOLD} ${GOLD}/90 md:${GOLD}!">x</p>`)
    expect(r.rewrites).toEqual([`hover:${GOLD} -> hover:${GOLD_INK}`, `${GOLD}/90 -> ${GOLD_INK}/90`, `md:${GOLD}! -> md:${GOLD_INK}!`])
  })

  it('a component drawn only on light grounds, and one drawn nowhere, which sits on the page', () => {
    const head = `function Item() {\n  return <a className="${GOLD}">x</a>\n}`
    expect(planFor('      <div className="bg-card"><Item /></div>', head).grounds).toEqual(['light'])
    expect(planFor('      <p>x</p>', head).grounds).toEqual(['light'])
  })

  it('rewrites commented-out code on a light ground, and leaves prose alone', () => {
    const body = `      <div className="bg-card">\n        {/* <p className="${GOLD}">old</p> */}\n        <p>x</p>\n      </div>`
    const r = planFor(body, `// The ${GOLD} class, named in prose, stays as written.`)
    expect(r.rewrites).toEqual([`${GOLD} -> ${GOLD_INK}`])
    expect(r.plan.uses[0].kind).toBe('comment')
    expect(r.after).toContain(`// The ${GOLD} class, named in prose`)
  })
})

describe('a Card or a dialog given a navy ground of its own', () => {
  it.each(['Card', 'SheetContent', 'DialogContent', 'PopoverContent'])('<%s className="bg-brand-navy"> is navy, so brand gold inside it stays', (tag) => {
    const r = planFor(`      <${tag} className="bg-brand-navy text-white"><span className="${GOLD}">x</span></${tag}>`)
    expect(r.grounds).toEqual(['navy'])
    expect(r.rewrites).toEqual([])
    expect(r.problems).toEqual([])
  })

  it('a Card with a tint of navy, which lies over its light ground, stays light', () => {
    const r = planFor(`      <section className="bg-brand-navy"><Card className="${c('bg-brand-navy', '/10')}"><span className="${GOLD}">x</span></Card></section>`)
    expect(r.grounds).toEqual(['light'])
  })

  it('gold-ink inside a Card given navy is a problem', () => {
    const r = planFor(`      <Card className="bg-brand-navy"><span className="${GOLD_INK}">x</span></Card>`)
    expect(r.problems).toHaveLength(1)
    expect(r.problems[0]).toContain('sits on a navy ground')
  })
})

describe('the names a component is drawn by', () => {
  const label = (declaration = 'export function Label') => `${declaration}() {\n  return <span className="${GOLD}">x</span>\n}\n`
  const groundsFor = (files: Record<string, string>) => planGold(tree(files), [], 'write').uses.map((u) => `${u.file} ${u.ground}`)

  it.each([
    ['the same name', "import { Label } from '@/components/Label'", 'Label', label()],
    ['a named import under another name', "import { Label as Mark } from '@/components/Label'", 'Mark', label()],
    ['a default import under another name', "import Mark from '@/components/Label'", 'Mark', label('export default function Label')],
    ['a default export given by name', "import Mark from '@/components/Label'", 'Mark', `function Label() {\n  return <span className="${GOLD}">x</span>\n}\nexport default Label\n`],
    ['an export under another name', "import { Mark } from '@/components/Label'", 'Mark', `function Label() {\n  return <span className="${GOLD}">x</span>\n}\nexport { Label as Mark }\n`],
    ['a namespace import', "import * as Parts from '@/components/Label'", 'Parts.Label', label()],
    ['a relative path', "import { Label } from '../components/Label'", 'Label', label()],
    ['lazy()', "import { lazy } from 'react'\nconst Mark = lazy(() => import('@/components/Label'))", 'Mark', label('export default function Label')],
    ['lazy() of a named export', "import { lazy } from 'react'\nconst Mark = lazy(() => import('@/components/Label').then((m) => ({ default: m.Label })))", 'Mark', label()],
  ])('follows a component to where it is drawn through %s', (_, head, tag, labelFile) => {
    const on = (ground: string) => ({ 'src/components/Label.tsx': labelFile, 'src/pages/User.tsx': page(`      <section className="${ground}"><${tag} /></section>`, head) })
    expect(groundsFor(on('bg-brand-navy'))).toEqual(['src/components/Label.tsx navy'])
    expect(groundsFor(on('bg-card'))).toEqual(['src/components/Label.tsx light'])
  })

  it.each([
    ['forwardRef()', `import { forwardRef } from 'react'\nexport const Label = forwardRef<HTMLSpanElement>((_props, ref) => <span ref={ref} className="${GOLD}">x</span>)\n`],
    ['React.memo()', `import * as React from 'react'\nexport const Label = React.memo(function Label() {\n  return <span className="${GOLD}">x</span>\n})\n`],
  ])('follows a component made with %s to where it is drawn', (_, labelFile) => {
    const user = page('      <section className="bg-brand-navy"><Label /></section>', "import { Label } from '@/components/Label'")
    expect(groundsFor({ 'src/components/Label.tsx': labelFile, 'src/pages/User.tsx': user })).toEqual(['src/components/Label.tsx navy'])
  })

  it('does not take a component of the same name from another module, or from a package, for it', () => {
    const other = 'export function Label() {\n  return <span>y</span>\n}\n'
    const user = page(
      '      <section className="bg-brand-navy"><Label /></section>\n      <section className="bg-brand-navy"><Pkg /></section>',
      "import { Label } from '@/components/Other'\nimport { Label as Pkg } from 'some-ui-package'",
    )
    expect(groundsFor({ 'src/components/Label.tsx': label(), 'src/components/Other.tsx': other, 'src/pages/User.tsx': user })).toEqual(['src/components/Label.tsx light'])
  })

  it('follows PageHero under another name too', () => {
    const r = planFor(`      <Hero title="x" meta={<span className="${GOLD}">y</span>} />`, "import { PageHero as Hero } from 'some-hero-package'")
    expect(r.grounds).toEqual(['navy'])
  })
})

describe('a component of the tree among the ancestors, read inside', () => {
  const groundsFor = (band: string, body: string, head = "import { Band } from '@/components/Band'") =>
    planGold(tree({ 'src/components/Band.tsx': band, 'src/pages/User.tsx': page(body, head) }), [], 'write').uses.map((u) => ({ ground: u.ground, why: u.why }))
  const component = (body: string, params = '{ children, className, meta, on }: { children?: ReactNode; className?: string; meta?: ReactNode; on?: boolean }') =>
    `import type { ReactNode } from 'react'\nexport function Band(${params}) {\n  ${body}\n}\n`

  it.each([
    ['its children, inside its navy', 'return <section className="bg-brand-navy px-4">{children}</section>', `<Band><span className="${GOLD}">x</span></Band>`, 'navy'],
    ['a prop it draws, inside its navy', 'return <section className="bg-brand-navy"><h2>{meta}</h2></section>', `<Band meta={<span className="${GOLD}">x</span>} />`, 'navy'],
    ['its children inside a fragment, inside its navy', 'return <section className="bg-brand-navy"><>{children}</></section>', `<Band><span className="${GOLD}">x</span></Band>`, 'navy'],
    ['its children, on a card inside its navy', 'return <section className="bg-brand-navy"><div className="bg-card">{children}</div></section>', `<Band><span className="${GOLD}">x</span></Band>`, 'light'],
    ['props spread onto its navy', 'return <section className="bg-brand-navy" {...{ children }} />', `<Band><span className="${GOLD}">x</span></Band>`, 'navy'],
    ['no ground of its own, over the caller\'s navy', 'return <div className="px-4">{children}</div>', `<section className="bg-brand-navy"><Band><span className="${GOLD}">x</span></Band></section>`, 'navy'],
    ['no ground of its own, over the caller\'s card', 'return <div className="px-4">{children}</div>', `<section className="bg-card"><Band><span className="${GOLD}">x</span></Band></section>`, 'light'],
    ['the caller\'s card, which its className lays over its own navy', 'return <section className={`bg-brand-navy ${className ?? \'\'}`}>{children}</section>', `<Band className="bg-card"><span className="${GOLD}">x</span></Band>`, 'light'],
    ['the caller\'s card on an inner element that takes its className, inside its navy', 'return <section className="bg-brand-navy"><div className={className}>{children}</div></section>', `<Band className="bg-card"><span className="${GOLD}">x</span></Band>`, 'light'],
    ['a className of the caller that it never reads', 'return <section className="bg-brand-navy">{children}</section>', `<Band className="bg-card"><span className="${GOLD}">x</span></Band>`, 'navy'],
    ['the gold as its className, which it puts on its navy', 'return <section className={`bg-brand-navy ${className ?? \'\'}`}>x</section>', `<Band className="${GOLD}" />`, 'navy'],
    ['the gold as its className, with the caller\'s card', 'return <section className={`bg-brand-navy ${className ?? \'\'}`}>x</section>', `<Band className="bg-card ${GOLD}" />`, 'light'],
    ['a component that returns its children bare, over the caller\'s navy', 'return children', `<section className="bg-brand-navy"><Band><span className="${GOLD}">x</span></Band></section>`, 'navy'],
  ])('%s', (_, body, use, ground) => {
    const [found] = groundsFor(component(body), `      ${use}`)
    expect(found.ground).toBe(ground)
  })

  it('a component that draws its children on navy in one branch and on a card in the other leaves them to a person', () => {
    const band = component('return on ? <section className="bg-brand-navy">{children}</section> : <div className="bg-card">{children}</div>')
    const [found] = groundsFor(band, `      <Band><span className="${GOLD}">x</span></Band>`)
    expect(found.ground).toBe('unplaced')
    expect(found.why).toContain('on more than one kind of ground')
  })

  it('a component that draws itself is left to a person, and the walk ends', () => {
    const band = component('return <Band>{children}</Band>', '{ children }: { children?: ReactNode }')
    const [found] = groundsFor(band, `      <Band><span className="${GOLD}">x</span></Band>`)
    expect(found.ground).toBe('unplaced')
  })

  it('a wrapper inside a wrapper: the inner paints nothing and the outer paints navy', () => {
    const files = {
      'src/components/Band.tsx': component('return <section className="bg-brand-navy"><Inner>{children}</Inner></section>') + "import { Inner } from './Inner'\n",
      'src/components/Inner.tsx': "import type { ReactNode } from 'react'\nexport function Inner({ children }: { children?: ReactNode }) {\n  return <div className=\"px-2\">{children}</div>\n}\n",
      'src/pages/User.tsx': page(`      <Band><span className="${GOLD}">x</span></Band>`, "import { Band } from '@/components/Band'"),
    }
    expect(planGold(tree(files), [], 'write').uses.map((u) => u.ground)).toEqual(['navy'])
  })
})

describe('what the script leaves to a person', () => {
  it.each([
    ['a string no className reads', '      <p>x</p>', `const TONE = { gold: '${GOLD}' }`, 'a string no className reads in its file'],
    ['a ground that may or may not apply with the gold', `      <a className={on ? 'bg-brand-navy' : 'bg-card'}><span className="${GOLD}">x</span></a>`, '', 'which may or may not apply with the gold'],
    ['a ground at one width only', `      <div className="${c('md:', 'bg-brand-navy')}"><p className="${GOLD}">x</p></div>`, '', 'a ground this script does not know'],
    ['a picture', `      <div className="bg-gradient-to-t"><p className="${GOLD}">x</p></div>`, '', 'a ground this script does not know'],
    ['an inline ground it cannot read', `      <div style={{ backgroundColor: on ? 'red' : 'blue' }}><p className="${GOLD}">x</p></div>`, '', 'an inline ground'],
    ['a colour given two hex digits of alpha that leave it opaque', '      <div style={{ backgroundColor: `${color}ff` }}><p className="' + GOLD + '">x</p></div>', '', 'an inline ground'],
    ['a default Button, whose fill follows the look', `      <Button><Bell className="${GOLD}" /> Go</Button>`, '', 'whose fill follows the look'],
    ['two grounds at once', `      <div className="bg-card bg-brand-navy"><p className="${GOLD}">x</p></div>`, '', 'two grounds at once'],
    ['a component drawn on both kinds of ground', '      <section className="bg-brand-navy"><Item /></section><div className="bg-card"><Item /></div>', `function Item() {\n  return <a className="${GOLD}">x</a>\n}`, 'drawn on more than one kind of ground'],
    ['commented-out code that names a navy ground before the class', `      {/* <div className="bg-brand-navy"><p className="${GOLD}">old</p></div> */}`, '', 'names a navy ground before the class'],
    ['a ground marked data-ground="dark" with no navy of its own: the home page hero\'s darkened photo', hero(GOLD), '', 'data-ground="dark" on <div> (line 7) with no navy of its own'],
    ['the urgent banner\'s red, where brand gold reads 3.58:1', `      <div className="${hexBg('9b1c1c')}"><p className="${GOLD}">x</p></div>`, '', 'a hex ground on which neither gold reads 4.5:1 (brand gold 3.58:1 and the dark gold 1.59:1 on #9b1c1c)'],
    ['the info banner\'s blue, where brand gold reads 3.84:1', `      <div className="${hexBg('1e4d7b')}"><p className="${GOLD}">x</p></div>`, '', 'brand gold 3.84:1 and the dark gold 1.70:1 on #1e4d7b'],
    ['Facebook\'s blue, where brand gold reads 1.86:1', `      <div className="${hexBg('1877f2')}"><p className="${GOLD}">x</p></div>`, '', 'brand gold 1.86:1 and the dark gold 1.21:1 on #1877f2'],
    ['a mid grey, where brand gold reads 1.97:1', `      <div className="${hexBg('777777')}"><p className="${GOLD}">x</p></div>`, '', 'brand gold 1.97:1 and the dark gold 1.15:1 on #777777'],
  ])('%s', (_, body, head, message) => {
    const r = planFor(body, head)
    expect(r.grounds).toEqual(['unplaced'])
    expect(r.rewrites).toEqual([])
    expect(r.problems).toHaveLength(1)
    expect(r.problems[0]).toContain(message)
    expect(r.problems[0]).toContain('test/unit/fixtures/goldAllowlist.ts')
  })

  it('an allowlist entry takes a use it cannot place, up to its count, and says when its count is wrong or it is not needed', () => {
    const entry: GoldAllowEntry = { file: 'src/pages/Planted.tsx', class: GOLD, count: 1, ground: 'navy', reason: 'A planted tone on a navy surface, for this test only.' }
    const head = `const TONE = { gold: '${GOLD}' }`
    const kept = planFor('      <p>x</p>', head, [entry])
    expect(kept.problems).toEqual([])
    expect(kept.plan.kept.map((k) => k.by)).toEqual(['allowlist'])
    expect(planFor('      <p>x</p>', head, [{ ...entry, count: 2 }]).problems).toEqual([
      `the allowlist gives src/pages/Planted.tsx ${GOLD} 2 uses the script cannot place, and it found 1: set its count`,
    ])
    // An entry for a use the script places itself is refused.
    const placed = planFor(`      <section className="bg-brand-navy"><p className="${GOLD}">x</p></section>`, '', [entry])
    expect(placed.problems).toHaveLength(1)
    expect(placed.problems[0]).toContain('is not needed: the script places this use itself')
    // An entry for a file that is not there.
    expect(planFor('      <p>x</p>', '', [{ ...entry, file: 'src/pages/Gone.tsx' }]).problems[0]).toContain('names a file that is not a .tsx file under src')
  })
})

describe('what stops a run', () => {
  it('a class on a light ground joined to a ${} substitution, or in a string with an escape', () => {
    const joined = planFor(`      <p className={\`p-2 ${GOLD}\${on ? ' x' : ''}\`}>x</p>`)
    expect(joined.problems).toHaveLength(1)
    expect(joined.problems[0]).toContain('runs into a ${} substitution')
    const escaped = planFor(`      <p className={'p-2 \\u0020${GOLD}'}>x</p>`)
    expect(escaped.problems).toHaveLength(1)
    expect(escaped.problems[0]).toContain('its string has an escape in it')
  })

  it('text-gold-ink on a navy ground, which the light look draws at 2.89:1', () => {
    const r = planFor(`      <section className="bg-brand-navy"><p className="${GOLD_INK}">x</p></section>`)
    expect(r.problems).toHaveLength(1)
    expect(r.problems[0]).toContain(`sits on a navy ground`)
    expect(r.problems[0]).toContain(`it should be ${GOLD}`)
  })

  it.each([
    ['the home page hero\'s darkened photo', hero(GOLD_INK), 'data-ground="dark" on <div> (line 7) with no navy of its own'],
    ['the urgent banner\'s red', `      <div className="${hexBg('9b1c1c')}"><p className="${GOLD_INK}">x</p></div>`, 'on #9b1c1c'],
    ['a navy at one width only', `      <div className="${c('md:', 'bg-brand-navy')}"><p className="${GOLD_INK}">x</p></div>`, 'a ground this script does not know'],
  ])('text-gold-ink on %s, a ground the script cannot place, which no allowlist entry can take', (_, body, why) => {
    const entry: GoldAllowEntry = { file: 'src/pages/Planted.tsx', class: GOLD_INK, count: 1, ground: 'navy', reason: 'A planted entry for gold-ink on a ground the script cannot place, for this test only.' }
    for (const allowlist of [[], [entry]]) {
      const r = planFor(body, '', allowlist)
      expect(r.grounds).toEqual(['unplaced'])
      expect(r.rewrites).toEqual([])
      expect(r.problems).toHaveLength(1)
      expect(r.problems[0]).toContain('sits on a ground this script cannot place')
      expect(r.problems[0]).toContain(why)
    }
    expect(reviewTable(planFor(body).plan)).toContain('| problem: not placed |')
  })
})

describe('the review table', () => {
  it('lists every use with its ground, what decided it, what the run does and the element', () => {
    const r = planFor(`      <section className="bg-brand-navy"><p className="${GOLD}">Navy</p></section>\n      <div className="bg-card"><p className="${GOLD}">Card</p></div>`)
    const table = reviewTable(r.plan)
    expect(table).toContain(`2 uses of ${GOLD} in 1 files: 1 on a light ground to rewrite to ${GOLD_INK}, 1 kept on a navy or dark ground, 0 kept by an allowlist entry, 0 problem(s).`)
    expect(table).toContain(`| src/pages/Planted.tsx | 7 | ${GOLD} | navy | bg-brand-navy on <section> (line 7) | kept | \`<p className="${GOLD}">\` |`)
    expect(table).toContain(`| src/pages/Planted.tsx | 8 | ${GOLD} | light | bg-card on <div> (line 8) | to ${GOLD_INK} |`)
  })
})

// ── The command line ───────────────────────────────────────────────────────

const SCRIPT = join(ROOT, 'scripts/codemods/gold-ink.ts')
const run = (...args: string[]) => spawnSync(process.execPath, ['--no-warnings', '--experimental-strip-types', SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8' })

/** A planted tree with the files the committed allowlist names, each holding its one use, so a run with the committed list can pass. */
function plantedWithAllowlist(files: Record<string, string>): string {
  const stubs: Record<string, string> = {}
  for (const e of GOLD_ALLOWLIST) stubs[e.file] = `export const TONES = { gold: '${GOLD}' }\n`
  return tree({ ...stubs, ...files })
}

describe('the command line', () => {
  it('prints the usage and stops on an unknown flag, --dry-run with --check, a flag with no value, or a stray word', () => {
    for (const args of [['--fast'], ['--dry-run', '--check'], ['--root'], ['--table', '--check'], ['stray']]) {
      const r = run(...args)
      expect(r.status, args.join(' ')).toBe(1)
      expect(r.stderr).toContain('Usage: node --no-warnings --experimental-strip-types scripts/codemods/gold-ink.ts')
    }
  })

  it('--dry-run prints the table and writes nothing; --table writes it to a file; a real run rewrites, and a second rewrites nothing', () => {
    const root = plantedWithAllowlist({ 'src/pages/Planted.tsx': page(`      <div className="bg-card"><p className="${GOLD}">x</p></div>`) })
    const before = readFileSync(join(root, 'src/pages/Planted.tsx'), 'utf8')
    const tablePath = join(root, 'review.md')
    const dry = run('--dry-run', '--root', root, '--table', tablePath)
    expect(dry.status, dry.stdout + dry.stderr).toBe(0)
    expect(dry.stdout).toContain('# Gold text: the review table')
    expect(readFileSync(join(root, 'src/pages/Planted.tsx'), 'utf8')).toBe(before)
    expect(existsSync(tablePath)).toBe(true)
    expect(readFileSync(tablePath, 'utf8')).toContain(`| to ${GOLD_INK} |`)
    expect(run('--check', '--root', root).status).toBe(1)
    const real = run('--root', root)
    expect(real.status, real.stdout + real.stderr).toBe(0)
    expect(real.stdout).toContain('Rewrote 1 classes in 1 files.')
    expect(readFileSync(join(root, 'src/pages/Planted.tsx'), 'utf8')).toBe(before.replace(GOLD, GOLD_INK))
    const again = run('--root', root)
    expect(again.stdout).toContain('Rewrote 0 classes in 0 files.')
    expect(run('--check', '--root', root).status).toBe(0)
  })

  it('a problem stops a real run before any file is written', () => {
    const root = plantedWithAllowlist({
      'src/pages/Planted.tsx': page(`      <div className="bg-card"><p className="${GOLD}">x</p></div>`),
      'src/pages/Other.tsx': page(`      <p>x</p>`, `const TONE = { gold: '${GOLD}' }`),
    })
    const before = readFileSync(join(root, 'src/pages/Planted.tsx'), 'utf8')
    const r = run('--root', root)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('Stopped: 1 problem(s). Nothing was written.')
    expect(readFileSync(join(root, 'src/pages/Planted.tsx'), 'utf8')).toBe(before)
  })

  it('--check on the real tree passes: 53 brand gold classes kept, 83 text-gold-ink in place, nothing left', () => {
    const r = run('--check')
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(r.stdout).toContain(`53 uses of ${GOLD} in 21 files: 0 on a light ground to rewrite to ${GOLD_INK}, 51 kept on a navy or dark ground, 2 kept by an allowlist entry, 0 problem(s). 83 ${GOLD_INK} already in place.`)
  })
})
