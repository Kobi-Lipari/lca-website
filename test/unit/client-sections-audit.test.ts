// test/unit/client-sections-audit.test.ts
//
// K2f: the site reads tournament sections through the contract-derived types
// and prices with priceShownSection over priceEntry. This scans the source
// text for what must not come back, and follows the site's runtime imports (as the bundler would) to
// show that none reaches zod or domain/contracts. scripts/check-bundle.ts
// (npm run check:bundle) proves the same on the built files; this is the
// early warning that names the importing file.
//
// - entryPrice and sectionBaseFee, the pricing adapter over the sections JSON
//   string, are not called, exported or defined anywhere in the code
// - no page or component passes a JSON string of sections to pricing
// - src/lib/api.ts derives the section, list and detail types from the
//   contracts, with import type only
// - every import of a contract or zod in src/ is `import type`, and no module
//   reachable from src/main.tsx through runtime imports is a contract or zod
// - the pages that read sections and price entries name the contract-derived
//   types and not a type of their own
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const text = (path: string) => readFileSync(join(ROOT, path), 'utf8')

function filesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`
    if (name === 'node_modules' || name === 'dist' || name === '.wrangler') return []
    if (statSync(join(ROOT, rel)).isDirectory()) return filesUnder(rel)
    return /\.(ts|tsx)$/.test(name) ? [rel] : []
  })
}

/** The source with // and block comments blanked, so prose that names a removed function is not a use. */
export function withoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (_m, pre: string) => pre)
}

interface Import { spec: string; typeOnly: boolean }

/** Every module a file names: import, export-from, dynamic import and require. */
export function importsOf(src: string): Import[] {
  const code = withoutComments(src)
  const out: Import[] = []
  for (const m of code.matchAll(/\b(import|export)\s+(type\s+)?(?:[\w*\s{},$]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
    // `import { type A } from 'x'` keeps the import at runtime under verbatimModuleSyntax, so it is not type-only.
    out.push({ spec: m[3], typeOnly: m[2] !== undefined })
  }
  for (const m of code.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push({ spec: m[1], typeOnly: false })
  for (const m of code.matchAll(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push({ spec: m[1], typeOnly: false })
  return out
}

const isContractOrZod = (spec: string) => spec === 'zod' || spec.startsWith('zod/') || /(^|\/)domain\/contracts(\/|$)/.test(spec) || spec.startsWith('@domain/contracts')

/** Where a spec points in the repo, or null for a package. */
export function resolveSpec(from: string, spec: string, exists: (p: string) => boolean): string | null {
  let base: string
  if (spec.startsWith('@domain/')) base = `domain/${spec.slice('@domain/'.length)}`
  else if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`
  else if (spec.startsWith('.')) base = relative(ROOT, resolve(ROOT, dirname(from), spec)).split('\\').join('/')
  else return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (/\.(ts|tsx)$/.test(candidate) && exists(candidate)) return candidate
  }
  return null
}

/**
 * Walks the runtime imports from `entry` and returns the first chain that
 * reaches a contract or zod, or null. `read` and `exists` are given so a
 * planted import can be tried on files that are not on disk.
 */
export function runtimeChainToZod(entry: string, read: (p: string) => string, exists: (p: string) => boolean): string[] | null {
  const seen = new Set<string>()
  const walk = (file: string, chain: string[]): string[] | null => {
    if (seen.has(file)) return null
    seen.add(file)
    for (const imp of importsOf(read(file))) {
      if (imp.typeOnly) continue
      if (isContractOrZod(imp.spec)) return [...chain, file, imp.spec]
      const target = resolveSpec(file, imp.spec, exists)
      if (target) {
        const found = walk(target, [...chain, file])
        if (found) return found
      }
    }
    return null
  }
  return walk(entry, [])
}

const disk = (p: string) => text(p)
const onDisk = (p: string) => existsSync(join(ROOT, p))

describe('the pricing adapter over the sections JSON string is gone', () => {
  it('entryPrice and sectionBaseFee appear in no code under src, functions, domain or scripts', () => {
    const hits: string[] = []
    for (const file of ['src', 'functions', 'domain', 'scripts'].flatMap(filesUnder)) {
      const code = withoutComments(text(file))
      for (const name of ['entryPrice', 'sectionBaseFee', 'PricedTournament']) {
        if (new RegExp(`\\b${name}\\b`).test(code)) hits.push(`${file} (${name})`)
      }
    }
    expect(hits).toEqual([])
  })

  it('no page or component hands pricing a JSON string of sections', () => {
    // (The manage page keeps a JSON snapshot of its own form state to tell what changed; it prices nothing.)
    const pricing = filesUnder('src').filter((file) => /\b(priceEntry|priceShownSection)\(/.test(withoutComments(text(file))))
    expect(pricing).toEqual(['src/components/family/FamilyRegistrationPanel.tsx', 'src/pages/TournamentDetailPage.tsx'])
    const hits = pricing.filter((file) => /sections\s*:\s*JSON\.stringify\(|JSON\.stringify\([^)]*\.sections\b/.test(withoutComments(text(file))))
    expect(hits).toEqual([])
  })

  it('the two pages that price an entry call priceShownSection with the answered section and the tournament', () => {
    for (const file of ['src/pages/TournamentDetailPage.tsx', 'src/components/family/FamilyRegistrationPanel.tsx']) {
      const code = withoutComments(text(file))
      expect(code, file).toMatch(/priceShownSection\([^,]*?sections?\b[^,]*,\s*tournament\s*,/)
      expect(code, file).not.toMatch(/\bpriceEntry\(/)
      expect(code, file).toContain("from '@/lib/pricing'")
    }
  })

  it('both re-export paths are one line over the domain module', () => {
    expect(text('src/lib/pricing.ts').trim()).toBe("export * from '@domain/registration/pricing'")
    expect(text('functions/utils/pricing.ts')).toContain("export * from '../../domain/registration/pricing'")
  })
})

describe('the site types come from the contracts', () => {
  const api = withoutComments(text('src/lib/api.ts'))

  it('src/lib/api.ts takes the section, list and detail types from the contracts with import type', () => {
    expect(importsOf(text('src/lib/api.ts')).filter((i) => isContractOrZod(i.spec))).toEqual([{ spec: '@domain/contracts', typeOnly: true }])
    expect(api).toMatch(/export type ApiTournamentSection = SavedSection\b/)
    expect(api).toMatch(/export type ApiTournamentListItem = TournamentListItem\b/)
    expect(api).toMatch(/TournamentDetailResponse\['tournament'\]/)
  })

  it('api.ts declares no section shape of its own', () => {
    expect(api).not.toMatch(/(interface|type)\s+ApiTournamentSection\s*(=\s*\{|\{)/)
    expect(api).not.toMatch(/sections\s*:\s*string\b/)
  })

  it('the setup screens and the editors edit sections as ApiSectionDraft, which keeps the id', () => {
    for (const file of ['src/components/admin/TournamentWizard.tsx', 'src/pages/TournamentManagePage.tsx', 'src/components/tournaments/SectionRulesEditor.tsx', 'src/components/tournaments/PrizesEditor.tsx']) {
      expect(withoutComments(text(file)), file).toContain('ApiSectionDraft')
    }
    expect(api).toMatch(/export type ApiSectionDraft = Partial<ApiTournamentSection> & Pick<ApiTournamentSection, 'name' \| 'entryFee'>/)
  })

  it('no client file declares its own tournament section interface', () => {
    const hits = filesUnder('src').filter((f) => f !== 'src/lib/api.ts' && /\binterface\s+\w*(Tournament|Event)Section\w*\b/.test(withoutComments(text(f))))
    expect(hits).toEqual([])
  })

  it('the wizard copies a template event without its section ids', () => {
    const wizard = withoutComments(text('src/components/admin/TournamentWizard.tsx'))
    expect(wizard).toMatch(/delete copy\.id/)
  })
})

describe('the site bundle takes no runtime import of a contract or zod', () => {
  it('every import of a contract or zod under src/ is `import type`', () => {
    const hits: string[] = []
    for (const file of filesUnder('src')) {
      for (const imp of importsOf(text(file))) if (isContractOrZod(imp.spec) && !imp.typeOnly) hits.push(`${file} imports ${imp.spec}`)
    }
    expect(hits).toEqual([])
  })

  it('no module reached from src/main.tsx through runtime imports is a contract or zod', () => {
    expect(runtimeChainToZod('src/main.tsx', disk, onDisk)).toBeNull()
  })

  it('the walk follows @/ and @domain imports into domain/ and finds a contract planted there', () => {
    const files: Record<string, string> = {
      'src/main.tsx': "import { App } from '@/App'\n",
      'src/App.tsx': "import { price } from '@/lib/pricing'\n",
      'src/lib/pricing.ts': "export * from '@domain/registration/pricing'\n",
      'domain/registration/pricing.ts': "import { check } from './check'\nexport const p = check\n",
      'domain/registration/check.ts': "import { savedSectionSchema } from '../contracts/events'\nexport const check = savedSectionSchema\n",
      'domain/contracts/events.ts': "import { z } from 'zod'\nexport const savedSectionSchema = z.object({})\n",
    }
    const read = (p: string) => files[p]
    const exists = (p: string) => p in files
    expect(runtimeChainToZod('src/main.tsx', read, exists)).toEqual([
      'src/main.tsx', 'src/App.tsx', 'src/lib/pricing.ts', 'domain/registration/pricing.ts', 'domain/registration/check.ts', 'domain/contracts/events.ts', 'zod',
    ])
    // The same chain with the contract taken as a type is clean.
    files['domain/registration/check.ts'] = "import type { SavedSection } from '../contracts/events'\nexport const check = 1 as unknown as SavedSection\n"
    expect(runtimeChainToZod('src/main.tsx', read, exists)).toBeNull()
  })

  it('treats `import { type X }` as a runtime import, and a dynamic import and an export-from too', () => {
    expect(importsOf("import { type A } from '@domain/contracts'")).toEqual([{ spec: '@domain/contracts', typeOnly: false }])
    expect(importsOf("import type { A } from '@domain/contracts'")).toEqual([{ spec: '@domain/contracts', typeOnly: true }])
    expect(importsOf("export * from 'zod'\nconst m = await import('@domain/contracts/events')")).toEqual([
      { spec: 'zod', typeOnly: false }, { spec: '@domain/contracts/events', typeOnly: false },
    ])
    expect(importsOf("// import { z } from 'zod'\n/* import x from 'zod' */")).toEqual([])
  })
})
