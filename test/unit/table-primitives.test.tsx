// @vitest-environment jsdom
//
// test/unit/table-primitives.test.tsx
//
// The table primitives of src/components/ui/table.tsx after WS01 step 27.
//
// - Opt-in: a table drawn as today's caller draws it (the fixture page's, with
//   every primitive) gives today's markup to the letter, rendered from the
//   file before the step, but for scope="col" on each TableHead, which draws
//   nothing new; the box keeps its three classes and gains no attribute.
// - TableHead says it heads a column (scope="col") unless told otherwise, and
//   TableRowHeader heads a row (scope="row"), spaced like a cell.
// - stickyFirst pins the first column, or with 2 the first two, each pinned
//   cell on the opaque surface with its row's --row-tint laid over it (the
//   hover tint and a selected row's tint set the same way), the row lines
//   drawn by the cells so they move with a pinned cell, and the second
//   column pinned at the first's width, read as the table is drawn and again
//   when the cell changes size.
// - label makes the box a named region in the tab order; bounded bounds it by
//   the viewport with its header held at the top on the surface, and both
//   keep a control the keyboard moves to clear of what is pinned, by a
//   scroll padding of what the pinned header and columns cover and the
//   ring's reach.
// - The types: bounded needs a label, stickyFirst is true or 2, and a row
//   header takes no scope of its own, checked with the TypeScript compiler
//   under the site's settings, as base-components-types.test.ts does.
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import ts from 'typescript'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow, TableRowHeader } from '@/components/ui/table'

/** Today's markup of the table below, rendered from the file at a12c74e, one row or cell a line. */
const TODAY = `
<div class="relative w-full overflow-auto">
<table class="w-full caption-bottom text-sm mt-3">
<caption class="mt-4 text-sm text-muted-foreground">Sample standings</caption>
<thead class="[&amp;_tr]:border-b">
<tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&amp;:has([role=checkbox])]:pr-0">Place</th>
<th class="h-12 px-4 text-left align-middle font-medium text-muted-foreground [&amp;:has([role=checkbox])]:pr-0">Player</th>
<th class="h-12 px-4 align-middle font-medium text-muted-foreground [&amp;:has([role=checkbox])]:pr-0 text-right">Score</th>
</tr>
</thead>
<tbody class="[&amp;_tr:last-child]:border-0">
<tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
<td class="p-4 align-middle [&amp;:has([role=checkbox])]:pr-0">1</td>
<td class="p-4 align-middle [&amp;:has([role=checkbox])]:pr-0">Player One</td>
<td class="p-4 align-middle [&amp;:has([role=checkbox])]:pr-0 text-right font-mono tabular-nums">3</td>
</tr>
<tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted" data-state="selected">
<td class="p-4 align-middle [&amp;:has([role=checkbox])]:pr-0">2</td>
<td class="p-4 align-middle [&amp;:has([role=checkbox])]:pr-0">Player Two</td>
<td class="p-4 align-middle [&amp;:has([role=checkbox])]:pr-0 text-right font-mono tabular-nums">2</td>
</tr>
</tbody>
<tfoot class="border-t bg-muted/50 font-medium [&amp;>tr]:last:border-b-0">
<tr class="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
<td class="p-4 align-middle [&amp;:has([role=checkbox])]:pr-0" colspan="3">Two players</td>
</tr>
</tfoot>
</table>
</div>
`.replace(/\n/g, '')

/** Today's caller, every primitive in it. */
function TodaysTable() {
  return (
    <Table className="mt-3">
      <TableCaption>Sample standings</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Place</TableHead>
          <TableHead>Player</TableHead>
          <TableHead className="text-right">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>1</TableCell>
          <TableCell>Player One</TableCell>
          <TableCell className="text-right font-mono tabular-nums">3</TableCell>
        </TableRow>
        <TableRow data-state="selected">
          <TableCell>2</TableCell>
          <TableCell>Player Two</TableCell>
          <TableCell className="text-right font-mono tabular-nums">2</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Two players</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}

// ── Sizes in jsdom: an element's width and height come from data-w and data-h ──

interface Watch { callback: ResizeObserverCallback; targets: Element[] }
let watches: Watch[] = []
beforeEach(() => {
  watches = []
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const width = Number(this.dataset.w ?? 0)
    const height = Number(this.dataset.h ?? 0)
    return { width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}) } as DOMRect
  })
  vi.stubGlobal('ResizeObserver', class {
    watch: Watch
    constructor(callback: ResizeObserverCallback) {
      this.watch = { callback, targets: [] }
      watches.push(this.watch)
    }
    observe(target: Element) {
      this.watch.targets.push(target)
    }
    unobserve() {}
    disconnect() {
      this.watch.targets = []
    }
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** A crosstable's first rows: a number, the name as the row's header and two more cells. */
function Pinned({ stickyFirst, bounded, label = 'Open crosstable' }: { stickyFirst?: true | 2; bounded?: boolean; label?: string }) {
  return (
    <Table label={label} stickyFirst={stickyFirst} bounded={bounded} containerClassName="max-h-48 rounded-xl border bg-surface">
      <TableHeader data-h="40">
        <TableRow className="[--row-tint:var(--muted)]">
          <TableHead data-w="44">#</TableHead>
          <TableHead data-w="160">Player</TableHead>
          <TableHead>Rd 1</TableHead>
          <TableHead>Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow className="[--row-tint:color-mix(in_oklab,var(--color-lca-gold)_5%,transparent)]">
          <TableCell>1</TableCell>
          <TableRowHeader>Player One</TableRowHeader>
          <TableCell>W 2</TableCell>
          <TableCell>1</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

const classesOf = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/)

describe('opt-in: today\'s caller draws today\'s markup', () => {
  it('a table with every primitive, drawn as today, is today\'s markup but for scope="col" on each TableHead', () => {
    const { container } = render(<TodaysTable />)
    const html = container.innerHTML
    expect(html.match(/ scope="col"/g)).toHaveLength(3)
    expect(html.replaceAll(' scope="col"', '')).toBe(TODAY)
  })

  it('the box gains no attribute and no class without a new prop', () => {
    const { container } = render(<TodaysTable />)
    const box = container.firstElementChild!
    expect([...box.attributes].map((a) => a.name)).toEqual(['class'])
    expect(box.getAttribute('class')).toBe('relative w-full overflow-auto')
    expect(box.querySelector('table')!.hasAttribute('style')).toBe(false)
    expect(watches).toEqual([])
  })

  it('forwards its ref to the table element', () => {
    const ref = createRef<HTMLTableElement>()
    render(<Table ref={ref}><tbody /></Table>)
    expect(ref.current?.tagName).toBe('TABLE')
  })
})

describe('header cells', () => {
  it('a TableHead heads its column unless told otherwise', () => {
    render(<table><thead><tr><TableHead>Place</TableHead><TableHead scope="colgroup">Rounds</TableHead></tr></thead></table>)
    expect(screen.getByRole('columnheader', { name: 'Place' }).getAttribute('scope')).toBe('col')
    expect(screen.getByText('Rounds').getAttribute('scope')).toBe('colgroup')
  })

  it('a TableRowHeader heads its row, spaced like a cell, in weight 500', () => {
    render(<table><tbody><tr><TableRowHeader className="px-3">Player One</TableRowHeader><TableCell>3</TableCell></tr></tbody></table>)
    const th = screen.getByRole('rowheader', { name: 'Player One' })
    expect(th.tagName).toBe('TH')
    expect(th.getAttribute('scope')).toBe('row')
    expect(classesOf(th)).toEqual(['p-4', 'text-left', 'align-middle', 'font-medium', '[&:has([role=checkbox])]:pr-0', 'px-3'])
    expect(screen.getByRole('cell', { name: '3' })).toBeTruthy()
  })
})

describe('stickyFirst', () => {
  it('pins the first column on the opaque surface with the row\'s tint over it, its row lines drawn by the cells', () => {
    const { container } = render(<Pinned stickyFirst />)
    const table = classesOf(container.querySelector('table')!)
    for (const c of [
      'border-separate', 'border-spacing-0', '[&_tr>*]:border-b', '[&_tbody>tr:last-child>*]:border-b-0',
      '[&_tr>:first-child]:sticky', '[&_tr>:first-child]:left-0', '[&_tr>:first-child]:z-[1]',
      '[&_tr>:first-child]:bg-surface', '[&_tr>:first-child]:bg-[image:linear-gradient(var(--row-tint),var(--row-tint))]',
      '[&_tr]:bg-(--row-tint)', '[&_tbody>tr]:hover:[--row-tint:color-mix(in_oklab,var(--muted)_50%,transparent)]',
      '[&_tr[data-state=selected]]:[--row-tint:var(--muted)]', '[&_tr>:first-child]:shadow-[inset_-1px_0_0_var(--border)]',
      // Important, so on paper it outranks the selectors that pin a cell or the header.
      'print:[&_tr>*]:static!',
    ]) expect(table, c).toContain(c)
    expect(table.some((c) => c.includes('nth-child(2)'))).toBe(false)
    expect(container.querySelector('table')!.style.getPropertyValue('--table-pin')).toBe('')
  })

  it('with 2, pins the second column too, at the first column\'s width, and follows it when it changes', () => {
    const { container } = render(<Pinned stickyFirst={2} />)
    const table = container.querySelector('table')!
    for (const c of ['[&_tr>:nth-child(2)]:sticky', '[&_tr>:nth-child(2)]:left-(--table-pin)', '[&_tr>:nth-child(2)]:bg-surface', '[&_tr>:nth-child(2)]:shadow-[inset_-1px_0_0_var(--border)]']) {
      expect(classesOf(table), c).toContain(c)
    }
    // The edge line is on the last pinned column only.
    expect(classesOf(table)).not.toContain('[&_tr>:first-child]:shadow-[inset_-1px_0_0_var(--border)]')
    expect(table.style.getPropertyValue('--table-pin')).toBe('44px')
    const box = screen.getByRole('region', { name: 'Open crosstable' })
    expect(box.style.scrollPaddingLeft).toBe(`${44 + 160 + 4}px`)
    // A wider place label widens the column; the observer moves the second column with it.
    const first = container.querySelector('th')!
    expect(watches.flatMap((w) => w.targets)).toContain(first)
    first.dataset.w = '60'
    for (const w of watches) w.callback([], {} as ResizeObserver)
    expect(table.style.getPropertyValue('--table-pin')).toBe('60px')
    expect(box.style.scrollPaddingLeft).toBe(`${60 + 160 + 4}px`)
  })

  it('lets go of its measurements when the table goes', () => {
    const { container, unmount } = render(<Pinned stickyFirst={2} bounded />)
    const table = container.querySelector('table')!
    const box = container.firstElementChild as HTMLElement
    expect(table.style.getPropertyValue('--table-pin')).toBe('44px')
    unmount()
    expect(table.style.getPropertyValue('--table-pin')).toBe('')
    expect([box.style.scrollPaddingLeft, box.style.scrollPaddingTop]).toEqual(['', ''])
    expect(watches.every((w) => w.targets.length === 0)).toBe(true)
  })
})

describe('the box', () => {
  it('with a label is a named region in the tab order, with the focus ring, and no bound', () => {
    render(<Pinned stickyFirst />)
    const box = screen.getByRole('region', { name: 'Open crosstable' })
    expect(box.tabIndex).toBe(0)
    for (const c of ['relative', 'w-full', 'overflow-auto', 'outline-none', 'focus-visible:ring-3', 'focus-visible:ring-focus', 'rounded-xl', 'border', 'bg-surface']) {
      expect(classesOf(box), c).toContain(c)
    }
    expect(classesOf(box)).not.toContain('max-h-[70vh]')
  })

  it('bounded, is bounded by the viewport with its overscroll kept inside, and prints whole', () => {
    render(<Pinned bounded />)
    const box = screen.getByRole('region', { name: 'Open crosstable' })
    // The caller's max-h-48 replaces the 70vh bound, as ScrollPanel's className does.
    expect(classesOf(box)).toContain('max-h-48')
    expect(classesOf(box)).not.toContain('max-h-[70vh]')
    for (const c of ['overscroll-contain', 'print:max-h-none', 'print:overflow-visible']) expect(classesOf(box), c).toContain(c)
  })

  it('bounded, holds its header at the top on the surface, the corner above the pinned columns', () => {
    const { container } = render(<Pinned bounded stickyFirst={2} />)
    const table = classesOf(container.querySelector('table')!)
    for (const c of [
      '[&_thead_th]:sticky', '[&_thead_th]:top-0', '[&_thead_th]:z-[2]', '[&_thead_th]:bg-surface',
      '[&_thead_th]:bg-[image:linear-gradient(var(--row-tint),var(--row-tint))]',
      '[&_thead_tr>:first-child]:z-[3]', '[&_thead_tr>:nth-child(2)]:z-[3]',
    ]) expect(table, c).toContain(c)
    // The header's height and the ring's reach, so a control under the header is scrolled clear of it.
    expect(screen.getByRole('region', { name: 'Open crosstable' }).style.scrollPaddingTop).toBe(`${40 + 4}px`)
  })

  it('without bounded, holds no header and sets no top padding', () => {
    const { container } = render(<Pinned stickyFirst />)
    expect(classesOf(container.querySelector('table')!).some((c) => c.startsWith('[&_thead_th]'))).toBe(false)
    expect((container.firstElementChild as HTMLElement).style.scrollPaddingTop).toBe('')
  })

  it('works without a ResizeObserver, measuring once', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const { container } = render(<Pinned stickyFirst={2} />)
    expect(container.querySelector('table')!.style.getPropertyValue('--table-pin')).toBe('44px')
  })
})

// ── What the types let a caller write ───────────────────────────────────────

const ROOT = join(__dirname, '../..')
const PROBE = join(ROOT, 'src/__type-probe__/table.tsx')
const HEADER = ["import { Table, TableHead, TableRowHeader } from '@/components/ui/table'"]
const COMPILES: Record<string, string> = {
  'today\'s table': '<Table className="mt-3"><tbody /></Table>',
  'a pinned first column': '<Table stickyFirst><tbody /></Table>',
  'two pinned columns in a named box': '<Table label="Open standings" stickyFirst={2}><tbody /></Table>',
  'a bounded box with its name': '<Table label="Sample crosstable" bounded containerClassName="max-h-48"><tbody /></Table>',
  'a header cell with another scope': '<TableHead scope="colgroup">Rounds</TableHead>',
  'a row header': '<TableRowHeader>Player One</TableRowHeader>',
}
const REFUSED: Record<string, string> = {
  'a bounded box with no name, which the keyboard could not be told about': '<Table bounded><tbody /></Table>',
  'three pinned columns': '<Table stickyFirst={3}><tbody /></Table>',
  'a name that is not words': '<Table label={2}><tbody /></Table>',
  'a row header with a scope of its own': '<TableRowHeader scope="col">Player One</TableRowHeader>',
}

function compile() {
  const config = ts.getParsedCommandLineOfConfigFile(join(ROOT, 'tsconfig.app.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    },
  })
  if (!config) throw new Error('tsconfig.app.json could not be read')
  const cases = [...Object.entries(COMPILES), ...Object.entries(REFUSED)]
  const source = `${[...HEADER, ...cases.map(([, jsx], i) => `export const case${i} = ${jsx}`)].join('\n')}\n`
  const options = { ...config.options, noEmit: true }
  const host = ts.createCompilerHost(options)
  const { getSourceFile, fileExists, readFile } = host
  host.getSourceFile = (name, version, ...rest) =>
    name === PROBE ? ts.createSourceFile(name, source, version, true, ts.ScriptKind.TSX) : getSourceFile.call(host, name, version, ...rest)
  host.fileExists = (name) => name === PROBE || fileExists.call(host, name)
  host.readFile = (name) => (name === PROBE ? source : readFile.call(host, name))
  const program = ts.createProgram({ rootNames: [PROBE], options, host })
  const errors = new Map<string, string[]>(cases.map(([name]) => [name, []]))
  const stray: string[] = []
  for (const d of ts.getPreEmitDiagnostics(program, program.getSourceFile(PROBE)!)) {
    const text = ts.flattenDiagnosticMessageText(d.messageText, ' ')
    const line = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line - HEADER.length : -1
    if (d.file?.fileName !== PROBE || line < 0 || line >= cases.length) stray.push(text)
    else errors.get(cases[line][0])!.push(text)
  }
  return { errors, stray }
}

describe('what the types let a caller write', () => {
  let probe: ReturnType<typeof compile>
  beforeAll(() => {
    probe = compile()
  }, 120_000)

  it('compiles the probe\'s own lines cleanly', () => {
    expect(probe.stray).toEqual([])
  })

  it.each(Object.keys(COMPILES))('compiles: %s', (name) => {
    expect(probe.errors.get(name)).toEqual([])
  })

  it.each(Object.keys(REFUSED))('refuses: %s', (name) => {
    expect(probe.errors.get(name)!.length).toBeGreaterThan(0)
  })
})
