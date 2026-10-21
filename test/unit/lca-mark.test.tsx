// @vitest-environment jsdom
//
// The rook mark and the official logo on their own (WS01 step 28), the two
// components of decision D1.
//
// - LcaMark is the one path of public/favicon.svg, read from that file here
//   so the two cannot drift apart, in the same 100 by 100 box, filled with
//   currentColor and nothing else: no colour, stroke or style of its own.
//   With no title it is an image named "Louisiana Chess Association", given
//   a title it is named by it, and given an empty or blank title it is
//   decoration, hidden from screen readers, with no title and no role. Its
//   title stays inside the SVG rather than going to the page's head. A
//   caller's class sets its size; its colour is the one it inherits from
//   the element around it, and no caller in src gives it one of its own,
//   which a contrast theme would leave in place on a ground it replaces.
// - LcaLogo draws one img of src/assets/lca-logo.webp, the official file (a
//   400 by 399 picture, read from the file's own header, with the hash it
//   has today), at the size it is given, with its words or with none, in its
//   own fixed shape and with nothing else.
// - What their types let a caller write, compiled with the site's settings
//   as test/unit/base-components-types.test.ts compiles its probe: a fill, a
//   colour or a style given to the mark, and a class, a style, a filter, a
//   colour, an opacity or another file given to the logo do not compile, so
//   no caller can recolour either.
//
// The class names the refused calls plant are put together when the test
// runs, so Tailwind, which reads this file, builds no CSS for them.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import ts from 'typescript'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import lcaLogo from '@/assets/lca-logo.webp'
import { LcaLogo } from '@/components/LcaLogo'
import { LcaMark } from '@/components/LcaMark'

afterEach(cleanup)

const ROOT = join(__dirname, '../..')
const NAME = 'Louisiana Chess Association'
const FAVICON = readFileSync(join(ROOT, 'public/favicon.svg'), 'utf8')
/** The favicon's box and its one path, as the file has them. */
const FAVICON_BOX = FAVICON.match(/<svg[^>]* viewBox="([^"]+)"/)?.[1]
const FAVICON_PATHS = [...FAVICON.matchAll(/<path[^>]* d="([^"]+)"/g)].map((m) => m[1])

/** The one mark a render draws. */
function mark(node: React.ReactElement): SVGSVGElement {
  const { container } = render(node)
  expect(container.children).toHaveLength(1)
  return container.firstElementChild as SVGSVGElement
}

describe('LcaMark: the favicon\'s rook, in the colour of its words', () => {
  it('is the favicon\'s one path, as the file has it, in the favicon\'s box', () => {
    expect(FAVICON_BOX).toBe('0 0 100 100')
    expect(FAVICON_PATHS).toHaveLength(1)
    expect(FAVICON_PATHS[0]).toMatch(/^M5 7\.1H16\.6V23H28\.3/)
    const svg = mark(<LcaMark />)
    expect(svg.tagName.toLowerCase()).toBe('svg')
    expect(svg.getAttribute('viewBox')).toBe(FAVICON_BOX)
    const paths = svg.querySelectorAll('path')
    expect(paths).toHaveLength(1)
    expect(paths[0].getAttribute('d')).toBe(FAVICON_PATHS[0])
  })

  it('has no colour of its own: it is filled with currentColor, with no stroke, style or colour class', () => {
    const svg = mark(<LcaMark />)
    expect(svg.getAttribute('fill')).toBe('currentColor')
    for (const el of [svg, ...svg.querySelectorAll('*')]) {
      for (const attr of ['stroke', 'style', 'color', 'opacity', 'filter']) expect(el.hasAttribute(attr), `${el.tagName} ${attr}`).toBe(false)
      if (el !== svg) expect(el.hasAttribute('fill'), el.tagName).toBe(false)
    }
    // The favicon's own navy and dark-scheme gold are not copied.
    expect(svg.outerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    // Its one class string is its default size: its colour is always the one it inherits.
    expect(svg.getAttribute('class')).toBe('size-9 flex-none')
  })

  it('is an image named "Louisiana Chess Association" when it is given no title', () => {
    const svg = mark(<LcaMark />)
    expect(screen.getByRole('img', { name: NAME })).toBe(svg)
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.hasAttribute('aria-hidden')).toBe(false)
    // An SVG title, the first thing in the mark, rather than an aria-label on an SVG with no role.
    expect(svg.firstElementChild?.tagName.toLowerCase()).toBe('title')
    expect(svg.firstElementChild?.textContent).toBe(NAME)
    expect(svg.hasAttribute('aria-label')).toBe(false)
    expect(svg.getAttribute('data-slot')).toBe('lca-mark')
  })

  it('takes the name it is given', () => {
    mark(<LcaMark title="Louisiana Chess Association, home" />)
    expect(screen.getByRole('img', { name: 'Louisiana Chess Association, home' })).toBeTruthy()
  })

  it.each([
    ['an empty title', ''],
    ['a blank title', '   '],
  ])('is decoration, hidden from screen readers, with %s', (_, title) => {
    const svg = mark(<LcaMark title={title} />)
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.hasAttribute('role')).toBe(false)
    expect(svg.querySelector('title')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    // Still the rook, in the words' colour.
    expect(svg.querySelector('path')?.getAttribute('d')).toBe(FAVICON_PATHS[0])
    expect(svg.getAttribute('fill')).toBe('currentColor')
  })

  it('keeps its title inside the SVG, not in the page\'s head', () => {
    const before = document.head.querySelectorAll('title').length
    const svg = mark(<LcaMark />)
    expect(document.head.querySelectorAll('title')).toHaveLength(before)
    expect(svg.querySelectorAll('title')).toHaveLength(1)
  })

  it('takes its size from a caller\'s class, the default size giving way', () => {
    expect(mark(<LcaMark title="" className="size-7 md:size-[30px]" />).getAttribute('class')).toBe('flex-none size-7 md:size-[30px]')
    cleanup()
    expect(mark(<LcaMark title="" className="size-[11px]" />).getAttribute('class')).toBe('flex-none size-[11px]')
  })

  it('is given a size and never a colour by every caller in src, so it takes the colour of the element around it', () => {
    const files = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx$/.test(f))
    const calls = files.flatMap((f) => [...readFileSync(join(ROOT, 'src', f), 'utf8').matchAll(/<LcaMark\b[^>]*>/g)].map((m) => `src/${f}: ${m[0]}`))
    // The header's brand link and the LCA tag.
    expect(calls).toHaveLength(2)
    for (const call of calls) {
      const classes = call.match(/className="([^"]*)"/)?.[1].split(/\s+/) ?? []
      expect(classes.length, call).toBeGreaterThan(0)
      // A text, fill or stroke class on the SVG itself would outlast a contrast theme's change of ground.
      expect(classes.filter((c) => /^(?:[\w-]+:)*(?:text|fill|stroke)-/.test(c)), call).toEqual([])
    }
  })

  it('carries the slot of a status tag\'s mark only when it is asked to', () => {
    expect(mark(<LcaMark title="" />).getAttribute('data-slot')).toBe('lca-mark')
    cleanup()
    expect(mark(<LcaMark title="" slot="status-mark" />).getAttribute('data-slot')).toBe('status-mark')
  })
})

describe('LcaLogo: the official logo, as it is', () => {
  it('draws one img of the official file, at the size it is given, with the name for its words', () => {
    const { container } = render(<LcaLogo width={56} height={56} />)
    expect(container.children).toHaveLength(1)
    const img = container.firstElementChild as HTMLImageElement
    expect(img.tagName).toBe('IMG')
    expect(img.getAttribute('src')).toBe(lcaLogo)
    expect(lcaLogo).toMatch(/lca-logo\.webp$/)
    expect(img.getAttribute('width')).toBe('56')
    expect(img.getAttribute('height')).toBe('56')
    expect(img.getAttribute('alt')).toBe(NAME)
    expect(screen.getByRole('img', { name: NAME })).toBe(img)
    // Its own fixed shape and nothing else: no style, no other attribute, nothing inside or over it.
    expect(img.getAttribute('class')).toBe('rounded-xl object-contain')
    expect(img.getAttribute('data-slot')).toBe('lca-logo')
    expect(img.getAttributeNames().sort()).toEqual(['alt', 'class', 'data-slot', 'height', 'src', 'width'])
    expect(img.children).toHaveLength(0)
  })

  it('takes empty words where the name stands beside it, and is then left out by a screen reader', () => {
    const { container } = render(<LcaLogo width={56} height={56} alt="" />)
    const img = container.firstElementChild as HTMLImageElement
    expect(img.getAttribute('alt')).toBe('')
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('draws a size of its own for each place', () => {
    const { container } = render(<LcaLogo width={160} height={160} />)
    const img = container.firstElementChild as HTMLImageElement
    expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['160', '160'])
    expect(img.getAttribute('src')).toBe(lcaLogo)
  })

  it('is the official file: a 400 by 399 picture of 16,468 bytes, unchanged', () => {
    const file = readFileSync(join(ROOT, 'src/assets/lca-logo.webp'))
    expect(file.length).toBe(16468)
    // RIFF, WEBP and a lossy picture ('VP8 '), whose frame header holds the size.
    expect(file.subarray(0, 4).toString('latin1')).toBe('RIFF')
    expect(file.subarray(8, 12).toString('latin1')).toBe('WEBP')
    expect(file.subarray(12, 16).toString('latin1')).toBe('VP8 ')
    expect(file.subarray(23, 26).toString('hex')).toBe('9d012a')
    expect(file.readUInt16LE(26) & 0x3fff).toBe(400)
    expect(file.readUInt16LE(28) & 0x3fff).toBe(399)
    // A recoloured or redrawn file is a decision someone makes, not a change that slips through.
    expect(createHash('sha256').update(file).digest('hex')).toBe('eb15b1d5e928557db8bdc02de89e56f583d75cdc01f4b669b3ba09079e7463ec')
  })

  it('imports the file the header and the footer drew, and no other', () => {
    const source = readFileSync(join(ROOT, 'src/components/LcaLogo.tsx'), 'utf8')
    expect(source.match(/^import .+$/gm)).toEqual(["import lcaLogo from '@/assets/lca-logo.webp'"])
    for (const file of ['src/components/layout/Navbar.tsx', 'src/components/layout/Footer.tsx']) {
      expect(readFileSync(join(ROOT, file), 'utf8'), file).toContain("import lcaLogo from '@/assets/lca-logo.webp'")
    }
  })
})

// ── What the types let a caller write ──────────────────────────────────────

/** Where the probe lives, as far as the compiler knows: under src, so the '@/' paths resolve as they do for the site. */
const PROBE = join(ROOT, 'src/__type-probe__/lca-marks.tsx')
/** A class, and a filter, that would recolour the logo, put together here so Tailwind does not read them. */
const GREY = ['gray', 'scale'].join('')
const FILTER = ['fil', 'ter'].join('')

const HEADER = [
  "import { LcaLogo } from '@/components/LcaLogo'",
  "import { LcaMark } from '@/components/LcaMark'",
]

/** Calls that must compile. */
const COMPILES: Record<string, string> = {
  'the mark with its default name': '<LcaMark />',
  'the mark with a name of its own': '<LcaMark title="Louisiana Chess Association, home" />',
  'the header\'s mark: decoration, sized, in the header\'s white': '<LcaMark title="" className="size-7 md:size-[30px]" />',
  'the LCA tag\'s mark': '<LcaMark title="" slot="status-mark" className="size-[11px]" />',
  'the footer\'s logo, with empty words': '<LcaLogo width={56} height={56} alt="" />',
  'the About page\'s logo, with its name': '<LcaLogo width={160} height={160} />',
}

/** Calls that must not compile, each with the words of the error that refuses it. */
const REFUSED: Record<string, [string, string]> = {
  'a mark given a fill': ['<LcaMark fill="#c8a94a" />', "Property 'fill' does not exist"],
  'a mark given a colour': ['<LcaMark color="#c8a94a" />', "Property 'color' does not exist"],
  'a mark given a style': ["<LcaMark style={{ color: '#c8a94a' }} />", "Property 'style' does not exist"],
  'a mark in a slot that is no part': ['<LcaMark slot="logo" />', 'is not assignable to type'],
  'a mark whose title is not words': ['<LcaMark title={1915} />', "Type 'number' is not assignable to type 'string'"],
  'a logo with no size': ['<LcaLogo />', 'missing the following properties'],
  'a logo with a width alone': ['<LcaLogo width={56} />', "Property 'height' is missing"],
  'a logo given a class': [`<LcaLogo width={56} height={56} className="${GREY}" />`, "Property 'className' does not exist"],
  'a logo given a style': [`<LcaLogo width={56} height={56} style={{ filter: '${GREY}(1)' }} />`, "Property 'style' does not exist"],
  'a logo given a filter': [`<LcaLogo width={56} height={56} ${FILTER}="${GREY}(1)" />`, `Property '${FILTER}' does not exist`],
  'a logo given a colour': ['<LcaLogo width={56} height={56} color="#1a2744" />', "Property 'color' does not exist"],
  'a logo given an opacity': ['<LcaLogo width={56} height={56} opacity={0.5} />', "Property 'opacity' does not exist"],
  'a logo given another file': ['<LcaLogo width={56} height={56} src="/lca-logo.jpg" />', "Property 'src' does not exist"],
  'a logo whose size is text': ['<LcaLogo width="56" height="56" />', "Type 'string' is not assignable to type 'number'"],
}

interface Probe {
  /** Error messages on each case's line, by the case's name. */
  errors: Map<string, string[]>
  /** Errors on the header lines or with no place, which would make every other result meaningless. */
  stray: string[]
}

function compile(): Probe {
  const config = ts.getParsedCommandLineOfConfigFile(join(ROOT, 'tsconfig.app.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    },
  })
  if (!config) throw new Error('tsconfig.app.json could not be read')
  const cases = [...Object.entries(COMPILES), ...Object.entries(REFUSED).map(([name, [jsx]]) => [name, jsx] as const)]
  const lines = [...HEADER, ...cases.map(([, jsx], i) => `export const case${i} = ${jsx}`)]
  const source = `${lines.join('\n')}\n`
  const options = { ...config.options, noEmit: true }
  const host = ts.createCompilerHost(options)
  const { getSourceFile, fileExists, readFile } = host
  host.getSourceFile = (name, version, ...rest) =>
    name === PROBE ? ts.createSourceFile(name, source, version, true, ts.ScriptKind.TSX) : getSourceFile.call(host, name, version, ...rest)
  host.fileExists = (name) => name === PROBE || fileExists.call(host, name)
  host.readFile = (name) => (name === PROBE ? source : readFile.call(host, name))
  const program = ts.createProgram({ rootNames: [PROBE], options, host })
  const file = program.getSourceFile(PROBE)!
  const errors = new Map<string, string[]>(cases.map(([name]) => [name, []]))
  const stray: string[] = []
  for (const d of ts.getPreEmitDiagnostics(program, file)) {
    const text = ts.flattenDiagnosticMessageText(d.messageText, ' ')
    if (!d.file || d.file.fileName !== PROBE || d.start === undefined) {
      stray.push(text)
      continue
    }
    const line = d.file.getLineAndCharacterOfPosition(d.start).line - HEADER.length
    if (line < 0 || line >= cases.length) stray.push(text)
    else errors.get(cases[line][0])!.push(text)
  }
  return { errors, stray }
}

describe('what the types let a caller write', () => {
  let probe: Probe
  beforeAll(() => {
    probe = compile()
  }, 120_000)

  it('the probe compiles its imports cleanly, so each result below is about its case', () => {
    expect(probe.stray).toEqual([])
  })

  it.each(Object.keys(COMPILES))('compiles: %s', (name) => {
    expect(probe.errors.get(name)).toEqual([])
  })

  it.each(Object.keys(REFUSED))('does not compile: %s', (name) => {
    const [jsx, because] = REFUSED[name]
    expect(probe.errors.get(name)!.length, jsx).toBeGreaterThan(0)
    expect(probe.errors.get(name)!.join(' '), jsx).toContain(because)
  })
})
