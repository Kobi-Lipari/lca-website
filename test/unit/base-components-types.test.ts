// test/unit/base-components-types.test.ts
//
// What the types of the WS01 step 26 components let a caller write, checked
// with the TypeScript compiler on a probe file of calls, one call a line,
// under the site's own compiler settings (tsconfig.app.json). test/ sits in
// no tsconfig, so a type error in a test file would never fail the build;
// the probe is compiled here instead, and each line must give an error or
// none, as it says.
//
// - StatusBadgeProps is a union: a status tag takes one of the eight
//   statuses and on="light", with words or without; a tone pill takes a tone
//   and words. A badge with both, with neither, with a status on navy, or a
//   pill with no words (missing, null, false or undefined) does not compile,
//   so no caller can ask for an empty badge.
// - StatusDot takes a string label; Button takes the gold variant and no
//   variant that does not exist; FilterChip, DateBlock and ScrollPanel need
//   their label, value and label.
// - Today's callers still compile: the fixture page's three pills and the
//   Scholastic page's pill from TOURNAMENT_STATUS.
import { join } from 'node:path'
import ts from 'typescript'
import { beforeAll, describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
/** Where the probe lives, as far as the compiler knows: under src, so the '@/' paths resolve as they do for the site. */
const PROBE = join(ROOT, 'src/__type-probe__/base-components.tsx')

const HEADER = [
  "import { StatusBadge, StatusDot } from '@/components/StatusBadge'",
  "import { Button } from '@/components/ui/button'",
  "import { FilterChip } from '@/components/ui/filter-chip'",
  "import { DateBlock } from '@/components/DateBlock'",
  "import { ScrollPanel } from '@/components/ScrollPanel'",
  "import { TOURNAMENT_STATUS } from '@/areas/events/tournamentStatus'",
  "import { BADGE_STATUSES } from '@/lib/badgeStatus'",
  "const status = TOURNAMENT_STATUS['upcoming'] ?? TOURNAMENT_STATUS.upcoming",
  'const noop = () => {}',
  "const maybe = Math.random() > 2 ? 'Opens Mon, Oct 12' : undefined",
]

/** Calls that must compile. */
const COMPILES: Record<string, string> = {
  'every status with its default words': '<>{BADGE_STATUSES.map((s) => <StatusBadge key={s} status={s} on="light" />)}</>',
  'a status tag with words of its own': '<StatusBadge status="live" on="light">Live · Round 3</StatusBadge>',
  'a status tag with an element for words': '<StatusBadge status="soon" on="light"><time dateTime="2026-10-12">Opens Mon, Oct 12</time></StatusBadge>',
  'a status tag whose words may be missing (it shows its default words)': '<StatusBadge status="soon" on="light">{maybe}</StatusBadge>',
  'a status tag with a className': '<StatusBadge status="closed" on="light" className="ml-2" />',
  'a tone pill on navy, the default': '<StatusBadge tone="muted">Coming soon</StatusBadge>',
  'the fixture page\'s pill': '<StatusBadge tone="emerald" on="light"><span data-status="open">Registration open</span></StatusBadge>',
  'the Scholastic page\'s pill': '<StatusBadge tone={status.tone} on="light">{status.label}</StatusBadge>',
  'a dot with no label': '<StatusDot regStatus="open" />',
  'a dot with a label and no status': '<StatusDot regStatus={null} label="Registration open until Fri, Oct 23" />',
  'the gold Button': '<Button variant="gold">Join the waitlist</Button>',
  'the gold Button on a link': '<Button variant="gold" size="sm" asChild><a href="/tournaments">Register</a></Button>',
  'a plain chip': '<FilterChip label="Classical" />',
  'a chip with everything': '<FilterChip label="Scholastic" count={2} pressed onPressedChange={(on) => void on} onRemove={noop} className="ml-1" />',
  'a date block for a string, a number, a Date and nothing': '<>{[<DateBlock key="a" value="2026-10-24" />, <DateBlock key="b" value={Date.now()} year />, <DateBlock key="c" value={new Date()} stored="utc" />, <DateBlock key="d" value={null} />]}</>',
  'a scroll panel with a header': '<ScrollPanel label="Setup steps" header={<p>Setup steps</p>}><ol /></ScrollPanel>',
}

/** Calls that must not compile, with why. */
const REFUSED: Record<string, string> = {
  'a status tag with no on': '<StatusBadge status="open" />',
  'a status tag on navy': '<StatusBadge status="open" on="navy" />',
  'a badge with a status and a tone': '<StatusBadge status="open" on="light" tone="emerald" />',
  'a badge with neither': '<StatusBadge />',
  'a badge with neither, given words': '<StatusBadge on="light">Registration open</StatusBadge>',
  'a status that does not exist': '<StatusBadge status="cancelled" on="light" />',
  'a tone that does not exist': '<StatusBadge tone="purple">Words</StatusBadge>',
  'a tone pill with no words': '<StatusBadge tone="gold" on="light" />',
  'a tone pill whose words are null': '<StatusBadge tone="gold" on="light">{null}</StatusBadge>',
  'a tone pill whose words are false': '<StatusBadge tone="gold" on="light">{false}</StatusBadge>',
  'a tone pill whose words are undefined': '<StatusBadge tone="gold" on="light">{undefined}</StatusBadge>',
  'a tone pill whose words may be missing': '<StatusBadge tone="gold" on="light">{maybe}</StatusBadge>',
  'a dot whose label is not words': '<StatusDot regStatus="open" label={2} />',
  'a Button variant that does not exist': '<Button variant="golden">Join</Button>',
  'a chip with no label': '<FilterChip count={2} />',
  'a chip whose count is text': '<FilterChip label="Classical" count="2" />',
  'a date block with no value': '<DateBlock />',
  'a date block stored in a way formatDate does not know': '<DateBlock value="2026-10-24" stored="local" />',
  'a scroll panel with no label': '<ScrollPanel><ol /></ScrollPanel>',
  'a scroll panel with nothing in it': '<ScrollPanel label="Setup steps" />',
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
  const cases = [...Object.entries(COMPILES), ...Object.entries(REFUSED)]
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

let probe: Probe
beforeAll(() => {
  probe = compile()
}, 120_000)

describe('the probe itself', () => {
  it('compiles its imports and its own lines cleanly, so each result below is about its case', () => {
    expect(probe.stray).toEqual([])
  })
})

describe('calls that compile', () => {
  it.each(Object.keys(COMPILES))('%s', (name) => {
    expect(probe.errors.get(name)).toEqual([])
  })
})

describe('calls that do not compile', () => {
  it.each(Object.keys(REFUSED))('%s', (name) => {
    expect(probe.errors.get(name)!.length, REFUSED[name]).toBeGreaterThan(0)
  })
})
