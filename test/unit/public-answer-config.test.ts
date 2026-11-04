// test/unit/public-answer-config.test.ts
//
// The two server constants of the Phase 0 trim, CLUB_EMAIL_HIDDEN and
// ROSTER_SHORT_NAMES, are constants in the code and nothing more (brief 0.2:
// functions and jobs cannot read src/lib/features.ts, so a server change a
// switch governs follows a constant set in the same change as its switch):
// - no configuration file, workflow, environment file or test binding
//   names either, so neither can be turned on from outside the code;
// - no function, worker or page reads either from its environment;
// - each is declared once, in the file the brief names for it
//   (functions/utils/clubs/publicAnswer.ts and
//   functions/utils/events/publicAnswer.ts), and nowhere else.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const CONSTANTS = [
  { name: 'CLUB_EMAIL_HIDDEN', home: 'functions/utils/clubs/publicAnswer.ts' },
  { name: 'ROSTER_SHORT_NAMES', home: 'functions/utils/events/publicAnswer.ts' },
] as const

/** Every file under `dir`, skipping folders of installed or built files. */
function filesUnder(dir: string, keep: (path: string) => boolean): string[] {
  const out: string[] = []
  const walk = (at: string) => {
    for (const entry of readdirSync(join(ROOT, at), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue
      const path = `${at}/${entry.name}`
      if (entry.isDirectory()) walk(path)
      else if (keep(path)) out.push(path)
    }
  }
  walk(dir)
  return out
}

/** The files that give the site, the functions, the workers and the tests their settings and bindings. */
function settingFiles(): string[] {
  const found = [
    'wrangler.toml',
    'workers/daily-emails/wrangler.toml',
    'workers/clearinghouse-sync/wrangler.toml',
    '.dev.vars.a11y',
    '.env.example',
    'package.json',
    'vite.config.ts',
    'vitest.config.ts',
    'vitest.integration.config.ts',
    'playwright.config.ts',
    ...readdirSync(join(ROOT, '.github/workflows')).map((name) => `.github/workflows/${name}`),
  ]
  for (const path of found) expect(existsSync(join(ROOT, path)), path).toBe(true)
  return found
}

const CODE = /\.(ts|tsx|js|mjs)$/

describe('the trim\'s two server constants are constants in the code alone', () => {
  it('no setting file, workflow or test binding names either', () => {
    const files = settingFiles()
    expect(files.length).toBeGreaterThan(10)
    for (const path of files) {
      const text = read(path)
      for (const { name } of CONSTANTS) expect(text, `${path} names ${name}`).not.toContain(name)
    }
  })

  it('no function, worker or page reads either from its environment', () => {
    const files = ['functions', 'workers', 'src'].flatMap((dir) => filesUnder(dir, (path) => CODE.test(path)))
    expect(files.length).toBeGreaterThan(100)
    for (const path of files) {
      const text = read(path)
      for (const { name } of CONSTANTS) {
        expect(text, `${path} reads ${name} from its environment`).not.toMatch(new RegExp(`\\benv\\??\\.${name}\\b|\\benv\\[['"]${name}['"]\\]|VITE_${name}`))
      }
    }
  })

  it('each is declared once, in the file the brief names for it', () => {
    const files = ['functions', 'workers', 'domain', 'src'].flatMap((dir) => filesUnder(dir, (path) => CODE.test(path)))
    for (const { name, home } of CONSTANTS) {
      const declared = files.filter((path) => new RegExp(`\\b(const|let|var)\\s+${name}\\b`).test(read(path)))
      expect(statSync(join(ROOT, home)).isFile(), home).toBe(true)
      expect(declared, name).toEqual([home])
    }
  })
})
