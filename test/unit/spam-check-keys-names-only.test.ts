// test/unit/spam-check-keys-names-only.test.ts
//
// The spam check's two keys are names in the tree and never values (WS09 step
// 25): TURNSTILE_SECRET_KEY for the server and VITE_TURNSTILE_SITE_KEY for
// the page. No real key is written in any file the step adds or changes,
// wrangler.toml is not given either name, the browser setup lists both as
// given empty, and the one place the server reads its key is the spam check,
// inside its function, so a key set after start-up is read at the next call.
// The only key-shaped values in the tree are the provider's published test
// keys, public values of its documentation, and each such file says so.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const walk = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.name === 'node_modules' ? [] : e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`])

const STEP_FILES = [
  '.env.example', 'functions/types.ts', 'src/vite-env.d.ts', 'test/a11y/global-setup.ts',
  'functions/utils/rateLimit.ts', 'functions/utils/spamCheck.ts', 'src/areas/clubs/components/SpamCheck.tsx', 'src/areas/clubs/spamCheckScript.ts',
  'functions/api/clubs/confirm/[token].ts', 'test/integration/harness.ts', 'REDESIGN_STATUS.md',
  ...walk('test').filter((f) => /(?:rate-limit|spam-check|rate_limits|ws09-step25)/.test(f)),
]
/** The shapes of the provider's real keys (its site keys and secrets begin 0x4) and of its published test keys (1x, 2x and 3x). */
const REAL_KEY = /\b0x4[A-Za-z0-9_-]{15,}/
const TEST_KEY = /\b[123]x0{5,}[A-Za-z0-9]*\b/

describe('the spam check\'s keys', () => {
  it('no file the step adds or changes holds a real key: nothing shaped like one of the provider\'s own keys', () => {
    for (const file of STEP_FILES) expect(read(file), file).not.toMatch(REAL_KEY)
  })

  it('a published test key stands only in a test, and its file says it is the provider\'s public test value', () => {
    const holding = STEP_FILES.filter((f) => TEST_KEY.test(read(f)))
    for (const file of holding) {
      expect(file, file).toMatch(/^test\//)
      expect(read(file), file).toMatch(/provider's published test|published test (?:secret|site key)/)
    }
  })

  it('the server and the page each have their own name, and the secret is never given to the page', () => {
    expect(read('functions/types.ts')).toMatch(/\n\s+TURNSTILE_SECRET_KEY\?: string\n/)
    expect(read('src/vite-env.d.ts')).toMatch(/\n\s+readonly VITE_TURNSTILE_SITE_KEY\?: string\n/)
    // The two files that declare the names say, in a comment, which is which.
    const page = walk('src').filter((f) => /\.(?:tsx?|html)$/.test(f) && f !== 'src/vite-env.d.ts')
    for (const file of page) expect(read(file), file).not.toMatch(/\bTURNSTILE_SECRET_KEY\b/)
    for (const file of walk('functions').filter((f) => f.endsWith('.ts') && f !== 'functions/types.ts')) expect(read(file), file).not.toMatch(/\bVITE_TURNSTILE_SITE_KEY\b/)
  })

  it('.env.example gives the site key as a name with no value and the secret as a comment with no value', () => {
    const lines = read('.env.example').split('\n')
    expect(lines.filter((l) => /TURNSTILE/.test(l) && /=/.test(l))).toEqual(['VITE_TURNSTILE_SITE_KEY=', '# TURNSTILE_SECRET_KEY='])
  })

  it('wrangler.toml, the one file that could give a value to every deployment, names neither key', () => {
    expect(read('wrangler.toml')).not.toMatch(/TURNSTILE/i)
    for (const file of walk('workers').filter((f) => /wrangler\.toml$/.test(f))) expect(read(file), file).not.toMatch(/TURNSTILE/i)
  })

  it('the browser setup lists both names among the secrets it gives empty, once each', () => {
    const setup = read('test/a11y/global-setup.ts')
    const list = setup.slice(setup.indexOf('export const A11Y_EMPTY_SECRETS = ['), setup.indexOf(']', setup.indexOf('export const A11Y_EMPTY_SECRETS = [')))
    for (const name of ['TURNSTILE_SECRET_KEY', 'VITE_TURNSTILE_SITE_KEY']) expect(list.split(`'${name}'`), name).toHaveLength(2)
    expect(setup.split('TURNSTILE_SECRET_KEY').length - 1).toBeLessThanOrEqual(2)
  })

  it('the spam check reads its secret inside its function, never at the head of the module', () => {
    const code = read('functions/utils/spamCheck.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const head = code.slice(0, code.indexOf('export async function checkSpam'))
    expect(head).not.toMatch(/\.TURNSTILE_SECRET_KEY/)
    expect(code.slice(code.indexOf('export async function checkSpam'))).toMatch(/const secret = env\.TURNSTILE_SECRET_KEY/)
  })
})
