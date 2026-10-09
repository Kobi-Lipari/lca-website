// test/unit/check-bundle.test.ts
//
// scripts/check-bundle.ts (npm run check:bundle) is shown to catch zod in a
// built bundle. Two tiny pages are built with vite, minified as the site
// build is: one takes the section contract at runtime (the mistake the
// check exists for), one takes only its type and prices an entry through
// domain/registration/pricing, as the tournament page does. The first must
// fail the check and the second must pass. The script is also run as npm
// runs it, on both folders and on a folder that does not exist.
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { findZod, ZOD_MARKERS } from '../../scripts/check-bundle'

const ROOT = join(__dirname, '../..')
const SCRIPT = 'scripts/check-bundle.ts'
const work = mkdtempSync(join(tmpdir(), 'check-bundle-'))

/** Builds `source` as a one-file page into its own assets folder and returns that folder. */
async function buildPage(name: string, source: string): Promise<string> {
  const src = join(work, `${name}-src`)
  const out = join(work, name, 'assets')
  mkdirSync(src, { recursive: true })
  writeFileSync(join(src, 'page.ts'), source)
  await build({
    configFile: false,
    logLevel: 'silent',
    root: src,
    resolve: { alias: { '@domain': join(ROOT, 'domain') } },
    build: {
      outDir: out,
      emptyOutDir: true,
      minify: true,
      lib: { entry: join(src, 'page.ts'), formats: ['es'], fileName: () => 'page.js' },
    },
  })
  return out
}

const run = (...args: string[]) =>
  spawnSync(process.execPath, ['--no-warnings', '--experimental-strip-types', SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8' })

describe('npm run check:bundle', () => {
  it('is the script, run the way the other TypeScript scripts are', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(pkg.scripts['check:bundle']).toBe(`node --no-warnings --experimental-strip-types ${SCRIPT}`)
  })

  it('looks for strings zod keeps after minifying', () => {
    expect(ZOD_MARKERS).toEqual(['ZodError', '_zod.def'])
  })

  it('catches a page that imports a contract at runtime, and passes one that takes only its type', async () => {
    const planted = await buildPage('planted', [
      "import { savedSectionSchema } from '@domain/contracts'",
      "export const ok = savedSectionSchema.safeParse({ name: 'Open' }).success",
      '',
    ].join('\n'))
    const clean = await buildPage('clean', [
      "import type { SavedSection } from '@domain/contracts'",
      "import { priceEntry } from '@domain/registration/pricing'",
      'export function price(section: SavedSection | undefined) {',
      '  return priceEntry({ feeRegular: section?.fees.regular }, { entry_fee: 30 }, Date.now(), { isLcaMember: false }).amount',
      '}',
      '',
    ].join('\n'))

    expect(readdirSync(planted).length).toBeGreaterThan(0)
    expect(readdirSync(clean).length).toBeGreaterThan(0)
    expect(findZod(planted)).toEqual([{ file: 'page.js', marker: 'ZodError' }])
    expect(findZod(clean)).toEqual([])

    const failed = run('--dir', planted)
    expect(failed.status).toBe(1)
    expect(failed.stderr).toContain('zod is in the site bundle')
    expect(failed.stderr).toContain('page.js (contains "ZodError")')
    expect(failed.stderr).toContain('import type')

    const passed = run('--dir', clean)
    expect(passed.status).toBe(0)
    expect(passed.stdout).toContain('No zod in the site bundle')
  }, 60_000)

  it('finds a marker in a file nested below the folder, whatever its type', () => {
    const dir = join(work, 'nested', 'assets')
    mkdirSync(join(dir, 'chunks'), { recursive: true })
    writeFileSync(join(dir, 'index.css'), 'body{color:red}')
    writeFileSync(join(dir, 'chunks', 'vendor.js'), 'var a=function(e){return e._zod.def}')
    expect(findZod(dir)).toEqual([{ file: 'chunks/vendor.js', marker: '_zod.def' }])
  })

  it('stops with a plain message when the folder does not exist', () => {
    const missing = run('--dir', join(work, 'not-built', 'assets'))
    expect(missing.status).toBe(1)
    expect(missing.stderr).toContain('Run npm run build first.')
  })
})
