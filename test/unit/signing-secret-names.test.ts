// test/unit/signing-secret-names.test.ts
//
// WS09 step 13: the two names of the signing secret, SIGNING_SECRET and
// SIGNING_SECRET_PREVIOUS, are written where the other secrets' names are
// written and given a value nowhere:
// - functions/types.ts carries both as optional;
// - .env.example names both, commented out and with no value;
// - the browser builds' list of secrets bound empty (test/a11y/global-setup.ts)
//   holds both;
// - no file in the repository gives either a value, and the two new helpers
//   read no environment of their own.
// The names are checked as text; no environment variable is read or printed.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8')
const NAMES = ['SIGNING_SECRET', 'SIGNING_SECRET_PREVIOUS']

describe('the names of the signing secret', () => {
  it('are optional on the Env of the functions', () => {
    const types = read('functions/types.ts')
    for (const name of NAMES) expect(types, name).toMatch(new RegExp(`^\\s+${name}\\?: string$`, 'm'))
    expect(types).not.toMatch(/^\s+SIGNING_SECRET(_PREVIOUS)?: string/m)
  })

  it('are named in .env.example, commented out, with no value', () => {
    const lines = read('.env.example').split('\n')
    for (const name of NAMES) {
      expect(lines, name).toContain(`# ${name}=`)
      const live = lines.filter((line) => line.startsWith(`${name}=`))
      expect(live, name).toEqual([])
    }
  })

  it('join the list of secrets the browser builds bind empty, and the list holds nothing else of this step', () => {
    const setup = read('test/a11y/global-setup.ts')
    const list = setup.slice(setup.indexOf('A11Y_EMPTY_SECRETS'))
    for (const name of NAMES) expect(list, name).toContain(`'${name}',`)
    // A name in that list is bound to the empty text, so no value is written beside either.
    expect(setup).not.toMatch(/SIGNING_SECRET(_PREVIOUS)?['"]?\s*[:=]\s*['"][^'"]/)
  })

  it('are given a value in no file of the repository', () => {
    const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n').filter((f) => f && !/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip|gz|lock|snap)$/.test(f) && f !== 'package-lock.json')
    const given = /\bSIGNING_SECRET(?:_PREVIOUS)?\b\s*(?:=|:)\s*['"]?[A-Za-z0-9+/_=.-]{8,}/
    const found: string[] = []
    for (const file of files) {
      let text: string
      try {
        text = read(file)
      } catch {
        continue
      }
      if (given.test(text)) found.push(file)
    }
    // Only the test files that quote a pattern or a line of the record may match; none may carry a real-looking value.
    expect(found.filter((f) => !f.startsWith('test/') && f !== 'REDESIGN_STATUS.md' && !f.startsWith('docs/'))).toEqual([])
  })

  it('are read by neither new helper: a secret is handed in by the caller', () => {
    for (const file of ['functions/utils/tokens.ts', 'functions/utils/admin/automations.ts']) {
      const code = read(file).split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/**')).join('\n')
      expect(code, file).not.toMatch(/\bSIGNING_SECRET/)
      expect(code, file).not.toMatch(/\bprocess\.env\b|\bcontext\.env\b|\benv\.[A-Z]/)
    }
  })
})
