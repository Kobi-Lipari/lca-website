// test/unit/sitemap-boundaries.test.ts
// What WS09 step 24's sitemap route must not become, read from the tree: a
// handler file outside functions/api with no contract, no pending line and no
// call from the site's own code; and a file that builds its addresses by the
// canonical link's code, reads the listed events only through listedWhere,
// and reads nothing of who is asking.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
import { PENDING_CONTRACTS } from './contracts-pending'
import { exportedMethods } from './routes'

const ROOT = join(__dirname, '../..')
const SITEMAP = join(ROOT, 'functions/sitemap.xml.ts')

/** The handler files under functions/ outside api, utils and db, as paths from the root, in order. */
function pageRouteFiles(dir = join(ROOT, 'functions'), prefix = 'functions'): string[] {
  const found: string[] = []
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name)
    const shown = `${prefix}/${name}`
    if (statSync(path).isDirectory()) {
      if (prefix === 'functions' && ['api', 'utils', 'db'].includes(name)) continue
      found.push(...pageRouteFiles(path, shown))
    } else if (name.endsWith('.ts') && !['types.ts', 'env.d.ts', '_middleware.ts'].includes(name) && !name.endsWith('.d.ts')) {
      found.push(shown)
    }
  }
  return found
}

/** The source with its comments taken out, so a word a comment holds is not read as code. */
const codeOf = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

/** Every source file under a folder, as text. */
function sourcesUnder(dir: string): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sourcesUnder(path))
    else if (/\.(ts|tsx)$/.test(name)) out.push({ path, text: readFileSync(path, 'utf8') })
  }
  return out
}

describe('the sitemap route in the tree', () => {
  it('is one of the four handler files outside functions/api, the three link previews and itself', () => {
    expect(pageRouteFiles()).toEqual([
      'functions/clubs/[id].ts',
      'functions/news/[slug].ts',
      'functions/sitemap.xml.ts',
      'functions/tournaments/[id].ts',
    ])
  })

  it('answers GET and no other method', () => {
    expect(exportedMethods(readFileSync(SITEMAP, 'utf8'))).toEqual(['GET'])
  })

  it('has no contract, no pending line and no call from the site\'s own code', () => {
    expect(Object.keys(contracts).filter((key) => /sitemap/i.test(key))).toEqual([])
    expect(PENDING_CONTRACTS.filter((line) => /sitemap/i.test(line))).toEqual([])
    const split = readFileSync(join(ROOT, 'test/unit/fixtures/api-added-since-split.json'), 'utf8')
    expect(split).not.toMatch(/sitemap/i)
    const callers = [...sourcesUnder(join(ROOT, 'src')), ...sourcesUnder(join(ROOT, 'domain'))].filter((file) => /sitemap\.xml/.test(file.text))
    // A page may say where the sitemap is in words; none may call it.
    for (const file of callers) expect(file.text, file.path).not.toMatch(/fetch\([^)]*sitemap/)
    expect(existsSync(join(ROOT, 'public/sitemap.xml'))).toBe(false)
  })
})

describe('the sitemap route\'s code', () => {
  const code = codeOf(SITEMAP)

  it('reads nothing of who is asking: no header, cookie, sign-in or body', () => {
    expect(code).not.toMatch(/\.headers\b|\bcookie\b|authorization|\.json\(|\.formData\(|\.text\(\)|getUser|verifyToken|accessToken|bearer/i)
    // The request is read for its address alone.
    for (const use of code.match(/context\.request\.\w+|request\.\w+/g) ?? []) expect(use).toBe('request.url')
  })

  it('builds each address by the canonical link\'s own code and carries no host or path rule of its own', () => {
    expect(code).toMatch(/pageAddress\(/)
    expect(code).toMatch(/clubAddress\(/)
    expect(code).toMatch(/clubPagePath\(/)
    expect(code).not.toMatch(/louisianachess|https?:\/\/(?!www\.sitemaps\.org)/)
    expect(code).not.toMatch(/SITE_URL|resolveSiteUrl|DEFAULT_SITE_URL|\.origin\b|\.host\b/)
  })

  it('reads the listed events through listedWhere and never by a word of the column', () => {
    expect(code).toMatch(/listedWhere\(/)
    expect(code).not.toMatch(/is_visible|isVisible|\bvisible\b/i)
  })

  it('reads the constant inside the function at each call and writes no other switch', () => {
    const handler = code.slice(code.indexOf('export const onRequestGet'))
    expect(handler).toMatch(/if \(!CLUB_PAGES_ON\) return context\.next\(\)/)
    expect(code.slice(0, code.indexOf('export const onRequestGet'))).not.toMatch(/CLUB_PAGES_ON\s*[?&|)]/)
    for (const other of ['CLUB_EMAIL_HIDDEN', 'ROSTER_SHORT_NAMES', 'CLUB_KEEPERS_ON', 'CREATION_ROLES_ON']) expect(code).not.toContain(other)
  })

  it('writes the sitemap protocol\'s namespace, one hour of caching and no cookie', () => {
    expect(code).toContain('http://www.sitemaps.org/schemas/sitemap/0.9')
    expect(code).toContain("'public, max-age=3600'")
    expect(code).not.toMatch(/Set-Cookie|Vary/i)
  })
})
