// The site's code is grouped by area under src/areas, and pages compose the
// areas. Three ESLint rules in eslint.config.js keep it that way:
// 1. a file in src/areas may not import a page (an error);
// 2. one area reaches another only through that area's index.ts or api.ts
//    (a warning for now, so the deep imports that already existed do not
//    fail the lint run; they are follow-ups in REDESIGN_STATUS.md);
// 3. a page does not call fetch itself (a warning, for the same reason).
// Each fixture in test/unit/fixtures/lint is linted with the real config as
// if it sat where the rule applies, so the rules are tested, not a copy. The
// last block pins the warnings the rules raise on the code as it stands, and
// checks each one is listed under Follow-ups in REDESIGN_STATUS.md.
import { readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { codeFiles, findSpecifiers, loadResolver, resolveSpecifier } from '../../scripts/move-files'

const ROOT = resolve(__dirname, '../..')
const FIXTURES = 'test/unit/fixtures/lint'
const read = (name: string) => readFileSync(join(ROOT, FIXTURES, name), 'utf8')

const eslint = new ESLint({ cwd: ROOT })

/** Lints a fixture's text as if it were the file at `asPath` (from the repo root). */
async function lintAs(fixture: string, asPath: string) {
  const text = read(fixture)
  const [result] = await eslint.lintText(text, { filePath: join(ROOT, asPath) })
  const lines = text.split('\n')
  return result.messages.map((m) => ({ ...m, source: lines[m.line - 1] }))
}

const PAGE_RULE = 'no-restricted-imports'
const AREA_RULE = '@typescript-eslint/no-restricted-imports'
const FETCH_RULES = ['no-restricted-globals', 'no-restricted-properties']

/** Lints `text` as if it were the file at `asPath`; returns "rule severity line" for the boundary rules only. */
async function lintText(text: string, asPath: string): Promise<string[]> {
  const [result] = await eslint.lintText(text, { filePath: join(ROOT, asPath) })
  return result.messages
    .filter((m) => m.ruleId === PAGE_RULE || m.ruleId === AREA_RULE || FETCH_RULES.includes(m.ruleId ?? ''))
    .map((m) => `${m.ruleId === AREA_RULE ? 'area' : m.ruleId === PAGE_RULE ? 'page' : 'fetch'} ${m.severity} ${m.line}`)
}

describe('rule 1: src/areas does not import src/pages', () => {
  const AS = 'src/areas/events/components/AreaImportsPage.tsx'

  it('reports each page import, by alias, relative path or type, as an error', async () => {
    const messages = (await lintAs('area-imports-page.tsx', AS)).filter((m) => m.ruleId === PAGE_RULE)
    expect(messages.map((m) => m.source)).toEqual([
      "import { HomePage } from '@/pages/HomePage'",
      "import { TournamentsPage } from '../../../pages/TournamentsPage'",
      "import type { ScholasticPage } from '../../../../src/pages/ScholasticPage'",
    ])
    for (const m of messages) {
      expect(m.severity).toBe(2)
      expect(m.message).toContain('src/areas cannot import a page')
    }
  })

  it('applies only inside src/areas', async () => {
    const messages = await lintAs('area-imports-page.tsx', 'src/components/AreaImportsPage.tsx')
    expect(messages.filter((m) => m.ruleId === PAGE_RULE)).toEqual([])
  })

  it('finds no src/areas file that imports a page today', async () => {
    // Only this rule runs, so the whole folder lints in a moment.
    const pageRuleOnly = new ESLint({ cwd: ROOT, ruleFilter: ({ ruleId }) => ruleId === PAGE_RULE })
    const results = await pageRuleOnly.lintFiles(['src/areas/**/*.{ts,tsx}'])
    expect(results.length).toBeGreaterThan(40)
    const found = results.flatMap((r) =>
      r.messages.filter((m) => m.ruleId === PAGE_RULE).map((m) => `${relative(ROOT, r.filePath)}:${m.line}`),
    )
    expect(found).toEqual([])
  }, 30_000)
})

describe('rule 2: one area reaches another through its index.ts or api.ts', () => {
  it('warns on a deep import of another area, by alias or relative path', async () => {
    const messages = (await lintAs('area-deep-import.tsx', 'src/areas/households/components/AreaDeepImport.tsx'))
      .filter((m) => m.ruleId === AREA_RULE)
    expect(messages.map((m) => m.source)).toEqual([
      "import { GradeConfirm } from '@/areas/events/components/GradeConfirm'",
      "import { UsChessMembership } from '../../membership/components/UsChessMembership'",
    ])
    for (const m of messages) {
      expect(m.severity).toBe(1)
      expect(m.message).toContain('through its index.ts or api.ts')
    }
  })

  it("allows every import of a file's own area", async () => {
    const messages = (await lintAs('area-deep-import.tsx', 'src/areas/events/components/AreaDeepImport.tsx'))
      .filter((m) => m.ruleId === AREA_RULE)
    // Seen from events, only the membership import leaves the area.
    expect(messages.map((m) => m.source)).toEqual([
      "import { UsChessMembership } from '../../membership/components/UsChessMembership'",
    ])
  })

  it('allows the index and api files of another area in every spelling', async () => {
    const text = [
      "import a from '@/areas/clubs'",
      "import b from '@/areas/clubs/index'",
      "import c from '@/areas/clubs/api'",
      "import d from '@/areas/clubs/api.ts'",
      "import e from '../../clubs'",
      "import f from '../../clubs/api'",
      '',
    ].join('\n')
    expect(await lintText(text, 'src/areas/events/components/Edge.tsx')).toEqual([])
  })

  it('warns on names that only start like api or index, and on re-exports and type imports', async () => {
    const text = [
      "import a from '@/areas/clubs/apiClient'",
      "import b from '@/areas/clubs/indexes'",
      "import c from '@/areas/clubs/api/helpers'",
      "export { d } from '@/areas/clubs/mapLocation'",
      "import type { E } from '../../../areas/clubs/mapLocation'",
      '',
    ].join('\n')
    expect(await lintText(text, 'src/areas/events/components/Edge.tsx')).toEqual([1, 2, 3, 4, 5].map((n) => `area 1 ${n}`))
  })

  it('leaves pages free to import area files by path', async () => {
    const messages = await lintAs('area-deep-import.tsx', 'src/pages/AreaDeepImportPage.tsx')
    expect(messages.filter((m) => m.ruleId === AREA_RULE)).toEqual([])
  })
})

describe('rule 3: pages do not call fetch', () => {
  it('warns on fetch, window.fetch and globalThis.fetch in a page', async () => {
    const messages = (await lintAs('page-calls-fetch.tsx', 'src/pages/PageCallsFetchPage.tsx'))
      .filter((m) => FETCH_RULES.includes(m.ruleId ?? ''))
    expect(messages.map((m) => m.source.trim())).toEqual([
      "void fetch('/api/clearinghouse?upcoming=true')",
      "void window.fetch('/api/clearinghouse?upcoming=false')",
      "void globalThis.fetch('/api/tournaments')",
    ])
    for (const m of messages) {
      expect(m.severity).toBe(1)
      expect(m.message).toContain('Pages call the area api modules')
    }
  })

  it('leaves methods and functions that only contain the word alone', async () => {
    const text = [
      'const client = { fetch: (u: string) => u }',
      "client.fetch('/a')",
      'function fetchTournaments() { return [] }',
      'export const list = fetchTournaments()',
      '',
    ].join('\n')
    expect(await lintText(text, 'src/pages/Edge.tsx')).toEqual([])
  })

  it('applies only to pages', async () => {
    const messages = await lintAs('page-calls-fetch.tsx', 'src/areas/events/components/PageCallsFetch.tsx')
    expect(messages.filter((m) => FETCH_RULES.includes(m.ruleId ?? ''))).toEqual([])
  })
})

describe('the rules leave clean code alone', () => {
  it('reports nothing for an area file that keeps to the boundaries', async () => {
    const messages = await lintAs('area-clean.tsx', 'src/areas/admin/components/AreaClean.tsx')
    expect(messages.map((m) => `${m.line} ${m.ruleId} ${m.message}`)).toEqual([])
  })

  it('keeps the fixtures out of the default lint run', async () => {
    for (const name of ['area-imports-page.tsx', 'area-deep-import.tsx', 'page-calls-fetch.tsx', 'area-clean.tsx']) {
      expect(await eslint.isPathIgnored(join(ROOT, FIXTURES, name)), name).toBe(true)
    }
  })
})

/** "file -> specifier" for each line a rule flagged across `globs`. */
async function flagged(ruleIds: string[], globs: string[]): Promise<string[]> {
  const only = new ESLint({ cwd: ROOT, ruleFilter: ({ ruleId }) => ruleIds.includes(ruleId) })
  const results = await only.lintFiles(globs)
  return results.flatMap((r) => {
    const lines = readFileSync(r.filePath, 'utf8').split('\n')
    return r.messages
      .filter((m) => ruleIds.includes(m.ruleId ?? ''))
      .map((m) => {
        const spec = /['"]([^'"]+)['"]/.exec(lines[m.line - 1])?.[1] ?? lines[m.line - 1].trim()
        return `${relative(ROOT, r.filePath)} -> ${spec}`
      })
  })
}

describe('the warnings the rules raise today are the listed follow-ups', () => {
  // These are the follow-ups in REDESIGN_STATUS.md. When one is fixed, remove
  // it here and from the list there; a new one fails this test, so it gets
  // listed (or fixed) rather than added to the warning count unnoticed.
  const CROSS_AREA_TODAY = [
    'src/areas/admin/components/ChampionsPanel.tsx -> @/areas/events/champions',
    'src/areas/admin/components/PostsPanel.tsx -> @/areas/governance/components/RichTextEditor',
    'src/areas/admin/components/TournamentWizard.tsx -> @/areas/events/components/SectionRulesEditor',
    'src/areas/households/components/FamilyCard.tsx -> @/areas/membership/components/UsChessMembership',
    'src/areas/households/components/FamilyRegistrationPanel.tsx -> @/areas/events/components/GradeConfirm',
  ]
  const PAGE_FETCH_TODAY = [
    'src/pages/HomePage.tsx',
    'src/pages/ScholasticPage.tsx',
    'src/pages/TournamentsPage.tsx',
    'src/pages/TournamentsPage.tsx',
  ]

  it('has exactly the known cross-area deep imports', async () => {
    expect((await flagged([AREA_RULE], ['src/areas/**/*.{ts,tsx}'])).sort()).toEqual(CROSS_AREA_TODAY)
  }, 60_000)

  it('has exactly the known page fetch calls', async () => {
    const found = await flagged(FETCH_RULES, ['src/pages/**/*.{ts,tsx}'])
    expect(found.map((s) => s.split(' -> ')[0]).sort()).toEqual(PAGE_FETCH_TODAY)
  }, 60_000)

  it('lists each of them under Follow-ups in REDESIGN_STATUS.md', () => {
    const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
    const entry = (start: string) => {
      const lines = status.split('\n')
      const at = lines.findIndex((l) => l.startsWith(start))
      if (at < 0) return ''
      let end = at + 1
      while (end < lines.length && /^\s+/.test(lines[end])) end++
      return lines.slice(at, end).join('\n')
    }
    const crossArea = entry('- **Imports across areas (step 19).**')
    for (const pair of CROSS_AREA_TODAY) {
      const [file, specifier] = pair.split(' -> ')
      expect(crossArea, pair).toMatch(new RegExp(`\`${file}\`[^\\n]*\`${specifier}\``))
    }
    const fetches = entry('- **Pages that call fetch (step 19).**')
    for (const file of new Set(PAGE_FETCH_TODAY)) expect(fetches, file).toContain(`\`${file}\``)
  })

  it('matches what resolving every import in src/areas finds, so the rule misses no spelling', () => {
    // Independent of ESLint: resolve each specifier (static, re-export,
    // dynamic and mock) and keep those that land in another area's files.
    const resolver = loadResolver(ROOT)
    const found: string[] = []
    for (const file of codeFiles(ROOT)) {
      const rel = relative(ROOT, file)
      const own = /^src\/areas\/([^/]+)\//.exec(rel)?.[1]
      if (!own) continue
      for (const s of findSpecifiers(file, readFileSync(file, 'utf8'))) {
        const target = resolveSpecifier(resolver, s.text, file)
        if (typeof target !== 'string') continue
        const hit = /\/src\/areas\/([^/]+)\/(.+)$/.exec(target)
        if (!hit || hit[1] === own || /^(index|api)\.[jt]sx?$/.test(hit[2])) continue
        found.push(`${rel} -> ${s.text}`)
      }
    }
    expect(found.sort()).toEqual(CROSS_AREA_TODAY)
  })
})
