// How ThemeScope is wired into the site (WS01 step 22).
//
// - ThemeScope is rendered by the fixture page and, since step 31, by the
//   heritage layout and the base resets of the forms on the heritage pages
//   (the governance documents' add and edit card, and the Board page's seat
//   cards an admin edits and its Add a board seat card); the site's entry
//   and its routes never name it. Only the loader ThemeScope uses
//   (src/lib/scopeStylesheets.ts) imports a look's font file, the live
//   look's and (since step 30) the heritage look's, each lazily, so no page
//   fetches one by accident; before step 31 ThemeScope imported them itself.
// - live.css declares only the Barlow Condensed and Barlow faces, in the
//   weights the Looks-7 tile names, and the two packages are pinned exactly.
// - The flags for the heritage and scholastic looks are not wired here: the
//   heritage file loads whatever the switches say, and its rules wait for
//   the new look themselves.
// - The files of the step, the heritage look's file and the files that draw
//   the heritage layout hold no dash character and name no tool.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { ROOT, read, stripComments } from './helpers/cssTokens'

/** Every source file under a folder, as a path from the repository root. */
function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const full = join(ROOT, dir, name)
    const rel = relative(ROOT, full)
    return statSync(full).isDirectory() ? sourceFiles(rel) : /\.(tsx?|css)$/.test(name) ? [rel] : []
  })
}

const SRC = sourceFiles('src')
const mentions = (needle: RegExp) => SRC.filter((f) => needle.test(readFileSync(join(ROOT, f), 'utf8'))).sort()

/** Every string a source file's code holds (an import, an import(), a URL or any other), its comments left out. */
function stringsIn(file: string): string[] {
  const sf = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const out: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.push(node.text)
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}
/** The source files whose code names a file, in any string, comments left out. */
const named = (needle: RegExp) => SRC.filter((f) => /\.tsx?$/.test(f) && stringsIn(f).some((s) => needle.test(s))).sort()

const LOADER = 'src/lib/scopeStylesheets.ts'

describe('where ThemeScope is used', () => {
  it('the fixture page, the heritage layout, the governance documents and the Board page render it, and the site entry and routes do not import it', () => {
    const users = mentions(/from '@\/components\/ThemeScope'/)
    expect(users).toEqual(['src/areas/governance/components/GovernanceDocuments.tsx', 'src/layouts/HeritageLayout.tsx', 'src/pages/BoardPage.tsx', 'src/pages/fixtures/ScopeFixturePage.tsx'])
    for (const file of ['src/main.tsx', 'src/App.tsx']) expect(read(file), file).not.toMatch(/ThemeScope/)
  })

  it('only ThemeScope uses the loader of the looks\' files', () => {
    expect(mentions(/from '@\/lib\/scopeStylesheets'/)).toEqual(['src/components/ThemeScope.tsx'])
    expect(named(/scopeStylesheets/)).toEqual(['src/components/ThemeScope.tsx'])
  })

  it('only the loader imports the live look\'s font file', () => {
    expect(named(/themes\/live\.css/)).toEqual([LOADER])
    // And as a lazy import, so the file is in a chunk of its own.
    expect(read(LOADER)).toMatch(/\(\)\s*=>\s*import\('@\/styles\/themes\/live\.css'\)/)
    expect(read(LOADER)).not.toMatch(/^import\s+['"]@\/styles/m)
  })

  it('only the loader imports the heritage look\'s file, and lazily, beside the live one', () => {
    expect(named(/themes\/heritage\.css/)).toEqual([LOADER])
    expect(named(/heritage\.css/)).toEqual([LOADER])
    const loader = read(LOADER)
    expect(loader).toMatch(/heritage:\s*\(\)\s*=>\s*import\('@\/styles\/themes\/heritage\.css'\)/)
    expect(loader).not.toMatch(/^import\s+['"]@\/styles/m)
    expect(loader).not.toMatch(/^import[^\n]*themes\//m)
    // Only the two looks with fonts of their own have a file: base never does, and scholastic waits for its own work.
    const fonts = loader.slice(loader.indexOf('const SCOPE_STYLESHEETS'), loader.indexOf('}', loader.indexOf('const SCOPE_STYLESHEETS')))
    expect([...fonts.matchAll(/^\s*(\w+):\s*\(\)\s*=>\s*import\(/gm)].map((m) => m[1]).sort()).toEqual(['heritage', 'live'])
    // ThemeScope keeps no import of its own.
    expect(read('src/components/ThemeScope.tsx')).not.toMatch(/import\(/)
  })

  it('does not wire the heritage and scholastic flags', () => {
    for (const file of ['src/components/ThemeScope.tsx', 'src/lib/themeScopes.ts', LOADER]) {
      expect(read(file), file).not.toMatch(/themeHeritage|themeScholastic|features/)
    }
  })
})

describe('live.css', () => {
  const css = stripComments(read('src/styles/themes/live.css'))
  const imports = [...css.matchAll(/@import\s+"([^"]+)";/g)].map((m) => m[1])

  it('holds only imports of the two Barlow packages, and no rule', () => {
    expect(imports.length).toBeGreaterThan(0)
    expect(css.replace(/@import\s+"[^"]+";/g, '').trim()).toBe('')
    for (const path of imports) expect(path, path).toMatch(/^@fontsource\/(barlow|barlow-condensed)\/\d{3}\.css$/)
  })

  it('imports the weights the Looks-7 tile names, each file once', () => {
    expect([...imports].sort()).toEqual(
      [
        '@fontsource/barlow-condensed/500.css',
        '@fontsource/barlow-condensed/600.css',
        '@fontsource/barlow-condensed/700.css',
        '@fontsource/barlow-condensed/800.css',
        '@fontsource/barlow/400.css',
        '@fontsource/barlow/500.css',
        '@fontsource/barlow/600.css',
      ].sort(),
    )
  })

  it('names only files the installed packages have', () => {
    for (const path of imports) expect(() => readFileSync(join(ROOT, 'node_modules', path)), path).not.toThrow()
  })

  it('loads no other typeface: no JetBrains Mono, no Big Shoulders Display', () => {
    expect(stripComments(read('src/styles/themes/live.css'))).not.toMatch(/jetbrains|big-shoulders|big shoulders/i)
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> }
    expect(Object.keys(pkg.dependencies).filter((n) => /jetbrains|big-shoulders/i.test(n))).toEqual([])
  })
})

describe('the font packages', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> }
  const lock = JSON.parse(read('package-lock.json')) as { packages: Record<string, { version?: string }> }

  it.each(['@fontsource/barlow', '@fontsource/barlow-condensed'])('%s is pinned exactly and the lock file agrees', (name) => {
    expect(pkg.dependencies[name]).toMatch(/^\d+\.\d+\.\d+$/)
    expect(lock.packages[`node_modules/${name}`]?.version).toBe(pkg.dependencies[name])
    expect(lock.packages[''] as unknown as { dependencies: Record<string, string> }).toMatchObject({ dependencies: { [name]: pkg.dependencies[name] } })
  })
})

describe('the files of the step', () => {
  const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
  const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'l' + 'lm', 'co-authored' + '-by'].join('|')})\\b`, 'i')
  const FILES = [
    'src/components/ThemeScope.tsx',
    'src/lib/themeScopes.ts',
    'src/lib/scopeStylesheets.ts',
    'src/styles/themes/live.css',
    'src/styles/themes/heritage.css',
    'src/layouts/HeritageLayout.tsx',
    'src/contexts/heritage-layout.ts',
    'src/components/ThickThinRule.tsx',
    'src/components/Seal.tsx',
    'test/unit/scope-stylesheets.test.tsx',
    'test/unit/governanceEditors.test.tsx',
    'test/unit/heritage-layout.test.tsx',
    'test/unit/heritage-ornaments.test.tsx',
    'test/unit/heritage-controls-tokens.test.tsx',
    'test/unit/heritage-app-routes.test.tsx',
    'test/unit/heritage-hooks.test.tsx',
    'test/unit/scope-stylesheets-edges.test.tsx',
    'test/unit/governanceEditors-bylaws.test.tsx',
    'test/unit/governanceEditors-board.test.tsx',
    'test/unit/themeScopes.test.ts',
    'test/unit/theme-scope.test.tsx',
    'test/unit/theme-scope-edges.test.tsx',
    'test/unit/theme-scope-wiring.test.ts',
    'test/unit/themeScopes-edges.test.ts',
    'test/a11y/scope-switch.spec.ts',
    'test/a11y/scope-switch-edges.spec.ts',
  ]

  it.each(FILES)('%s has no em dash, no en dash and no reference to a tool that wrote it', (file) => {
    const text = read(file)
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(/\bAI\b/)
  })
})
