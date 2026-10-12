// There is no member price (decision D11), so nothing a person reads may
// advertise one: no page, no price line, no email and no server message.
// This scans the text of the site (src/), the pricing labels
// (domain/registration), the server (functions/, which holds the email
// templates in functions/utils/registrationEmails.ts and emailLayout.ts and
// every refusal a page shows) and the scheduled workers (workers/, the
// reminder emails), with code comments taken out, for wording such as
// "member price", "member discount" or "LCA members save".
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const SCANNED = ['src', 'domain/registration', 'functions', 'workers']
const SOURCE = /\.(ts|tsx|js|jsx|html)$/

/** Words that would offer or describe a price that depends on membership. */
const MEMBER_PRICE_COPY: RegExp[] = [
  /\bmembers?(?:'s)?\s+(?:price|pricing|prices|rate|rates|discount|discounts)\b/i,
  /\bmember-only\s+(?:price|pricing|rate|discount)\b/i,
  /\bmembers?\s+(?:save|saves|get\s+\$|pay\s+(?:less|only|just|\$))/i,
  /\bdiscounted\s+(?:tournament\s+)?(?:entry|entries|entry\s+fees?)\b/i,
  /\b(?:entry|entries)\s+discounts?\s+for\s+members\b/i,
  /\bsave\s+\$?\d*\s*(?:on\s+entry\s+)?(?:as|with)\s+(?:an?\s+)?(?:LCA\s+)?member(?:ship)?\b/i,
]

function filesUnder(dir: string): string[] {
  const full = join(ROOT, dir)
  if (statSync(full).isFile()) return [full]
  return readdirSync(full).flatMap((name) => {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) return []
    const path = join(full, name)
    if (statSync(path).isDirectory()) return filesUnder(relative(ROOT, path))
    return SOURCE.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

/**
 * The text with comments taken out: block comments (and JSX {/* ... *\/}),
 * and line comments that start a line or follow whitespace or code, but not
 * the // inside a URL such as https://.
 */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join('\n')
}

function memberPriceCopy(text: string): string[] {
  const code = withoutComments(text)
  return MEMBER_PRICE_COPY.flatMap((pattern) => {
    const found = code.match(new RegExp(pattern.source, `${pattern.flags}g`))
    return found ?? []
  })
}

describe('no wording advertises a member price', () => {
  const files = SCANNED.flatMap(filesUnder)

  it('scans the site, the pricing labels, the server with its email templates, and the workers', () => {
    const rel = files.map((f) => relative(ROOT, f))
    expect(rel).toContain('src/pages/TournamentDetailPage.tsx')
    expect(rel).toContain('src/pages/TournamentManagePage.tsx')
    expect(rel).toContain('src/pages/HomePage.tsx')
    expect(rel).toContain('src/pages/MembershipPage.tsx')
    expect(rel).toContain('src/components/family/FamilyRegistrationPanel.tsx')
    expect(rel).toContain('domain/registration/pricing.ts')
    expect(rel).toContain('functions/utils/registrationEmails.ts')
    expect(rel).toContain('functions/utils/emailLayout.ts')
    expect(rel).toContain('workers/daily-emails/src/index.ts')
    expect(files.length).toBeGreaterThan(200)
  })

  it('finds none in any of them', () => {
    const hits = files.flatMap((file) => memberPriceCopy(readFileSync(file, 'utf8')).map((hit) => `${relative(ROOT, file)}: ${hit}`))
    expect(hits).toEqual([])
  })

  it('the old wording is gone: the price line, the setup input and the tournament page note', () => {
    const all = files.map((f) => withoutComments(readFileSync(f, 'utf8'))).join('\n')
    expect(all).not.toContain('LCA member discount')
    expect(all).not.toContain('LCA members save')
    expect(all).not.toContain('discounted tournament entry')
    expect(all).not.toContain('p-member')
  })
})

describe('the scan itself', () => {
  it('catches each form of the wording', () => {
    for (const text of [
      '<span>LCA member discount</span>',
      "label: 'Member price'",
      '<p>LCA members save $5 on entry.</p>',
      '`Members pay only $20`',
      'unlock member benefits including discounted tournament entry',
      '"Entry discounts for members"',
      'Save $5 as an LCA member',
      "const copy = 'member rate'",
    ]) {
      expect(memberPriceCopy(text), text).not.toEqual([])
    }
  })

  it('ignores comments, identifiers and wording that is about membership but not price', () => {
    for (const text of [
      '// there is no member price',
      '/* the LCA member discount was retired */',
      '{/* LCA members save: removed */}',
      'member_discount: dollarsSchema',
      'memberDiscount?: number | null',
      '<p>LCA membership required to enter · $15 a year</p>',
      '<h2>Member Benefits</h2>',
      "label: 'Early entry discount'",
      "fetch('https://example.com/member-discount')",
      'Same benefits as adult membership at a reduced rate to support youth chess.',
    ]) {
      expect(memberPriceCopy(text), text).toEqual([])
    }
  })
})
