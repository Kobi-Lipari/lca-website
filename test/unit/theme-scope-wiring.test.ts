// How ThemeScope is wired into the site (WS01 step 22).
//
// - Nothing renders ThemeScope but the fixture page, and only ThemeScope
//   imports the live look's font file, so no page fetches it by accident.
// - live.css declares only the Barlow Condensed and Barlow faces, in the
//   weights the Looks-7 tile names, and the two packages are pinned exactly.
// - The flags for the heritage and scholastic looks are not wired here.
// - The files of the step hold no dash character and name no tool.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
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

describe('where ThemeScope is used', () => {
  it('only the fixture page renders it, and the site entry and routes do not import it', () => {
    const users = mentions(/from '@\/components\/ThemeScope'/)
    expect(users).toEqual(['src/pages/fixtures/ScopeFixturePage.tsx'])
    for (const file of ['src/main.tsx', 'src/App.tsx']) expect(read(file), file).not.toMatch(/ThemeScope/)
  })

  it('only ThemeScope imports the live look\'s font file', () => {
    expect(mentions(/themes\/live\.css/)).toEqual(['src/components/ThemeScope.tsx'])
    // And as a lazy import, so the file is in a chunk of its own.
    expect(read('src/components/ThemeScope.tsx')).toMatch(/\(\)\s*=>\s*import\('@\/styles\/themes\/live\.css'\)/)
    expect(read('src/components/ThemeScope.tsx')).not.toMatch(/^import\s+['"]@\/styles/m)
  })

  it('does not wire the heritage and scholastic flags', () => {
    for (const file of ['src/components/ThemeScope.tsx', 'src/lib/themeScopes.ts']) {
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
    'src/styles/themes/live.css',
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
