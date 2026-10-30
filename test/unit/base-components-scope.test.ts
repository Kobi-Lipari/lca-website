// test/unit/base-components-scope.test.ts
//
// Where the base components of WS01 step 26 are drawn: only on the fixture
// page, which exists only in the accessibility test build, so no page a
// visitor sees changes (the step's acceptance criterion 7).
//
// - FilterChip, DateBlock and ScrollPanel are imported by the fixture page
//   and by nothing else under src, however the import is written (by alias,
//   by relative path or lazily).
// - The list of statuses and their words is read by StatusBadge and the
//   fixture page only.
// - Only the fixture page draws StatusBadge's status path, only the fixture
//   page and the new header of WS02 step 5 draw the Button's gold variant,
//   and no caller gives StatusDot a label.
// - ADMIN_SCROLL, which ScrollPanel generalises, keeps its value and its
//   ten uses in nine admin files, none of which moves to the panel yet (that
//   is WS06's and WS08's, as REDESIGN_STATUS.md records).
//
// A later workstream that draws one of these on a page changes the list here
// in the same change, so each new place is a decision someone made.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const FIXTURE = 'src/pages/fixtures/ScopeFixturePage.tsx'

/** Every source file under a folder, as a path from the repository root. */
function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const full = join(ROOT, dir, name)
    const rel = relative(ROOT, full)
    return statSync(full).isDirectory() ? sourceFiles(rel) : /\.(tsx?|jsx?|mjs)$/.test(name) ? [rel] : []
  })
}

const SRC = sourceFiles('src')
const text = new Map(SRC.map((f) => [f, readFileSync(join(ROOT, f), 'utf8')]))

/** The files that import a module by any path that ends in its name: '@/…', a relative path, or import(). */
function importersOf(moduleName: string): string[] {
  const spec = new RegExp(`(?:from\\s*|import\\s*\\(\\s*|import\\s+)['"][^'"]*/${moduleName}(?:\\.tsx?)?['"]`)
  return SRC.filter((f) => spec.test(text.get(f)!)).sort()
}

/** The files whose code holds a match, comments left out. */
function drawnIn(pattern: RegExp): string[] {
  return SRC.filter((f) => pattern.test(text.get(f)!.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''))).sort()
}

describe('the new components are drawn on the fixture page only', () => {
  it.each(['filter-chip', 'DateBlock', 'ScrollPanel'])('%s is imported by the fixture page and nothing else under src', (name) => {
    expect(importersOf(name)).toEqual([FIXTURE])
  })

  it('the statuses and their words are read by StatusBadge and the fixture page only', () => {
    expect(importersOf('badgeStatus')).toEqual(['src/components/StatusBadge.tsx', FIXTURE].sort())
  })

  it('only the fixture page draws a status tag', () => {
    expect(drawnIn(/<StatusBadge\b[^>]*\bstatus=/)).toEqual([FIXTURE])
  })

  it('only the fixture page and the new header draw the gold Button', () => {
    // WS02 step 5's header draws Join LCA and Renew as the gold Button, its first place off the fixture page.
    expect(drawnIn(/\bvariant=(?:"gold"|'gold'|\{\s*['"]gold['"]\s*\})/)).toEqual(['src/components/layout/SiteHeader.tsx', FIXTURE].sort())
  })

  it('no caller gives StatusDot a label yet, so its one page caller shows its state\'s words', () => {
    expect(drawnIn(/<StatusDot\b[^>]*\blabel=/)).toEqual([])
    expect(drawnIn(/<StatusDot\b/)).toEqual(['src/pages/HomePage.tsx', 'src/pages/TournamentsPage.tsx', FIXTURE].sort())
    // HomePage draws a StatusDot of its own, not the shared one (see Follow-ups, "HomePage's own StatusDot (step 26)").
    expect(text.get('src/pages/HomePage.tsx')).toMatch(/^function StatusDot\(/m)
    expect(text.get('src/pages/HomePage.tsx')).not.toMatch(/import \{[^}]*\bStatusDot\b[^}]*\} from/)
  })

  it('the fixture page is loaded only by the accessibility test build\'s route', () => {
    expect(importersOf('ScopeFixturePage')).toEqual(['src/App.tsx'])
    expect(text.get('src/App.tsx')).toMatch(/import\.meta\.env\.MODE === 'a11y'\s*\n?\s*\? lazy\(\(\) => import\('@\/pages\/fixtures\/ScopeFixturePage'\)/)
  })
})

describe('ADMIN_SCROLL stays as it was', () => {
  it('keeps its value, and its ten uses in nine admin files, none moved to ScrollPanel yet', () => {
    expect(text.get('src/lib/brand.ts')).toContain("export const ADMIN_SCROLL = 'max-h-[70vh] overflow-auto overscroll-contain'")
    const uses = SRC.filter((f) => f !== 'src/lib/brand.ts' && f !== 'src/components/ScrollPanel.tsx').flatMap((f) =>
      [...text.get(f)!.matchAll(/\bADMIN_SCROLL\b/g)].length > 1 ? [[f, [...text.get(f)!.matchAll(/\bADMIN_SCROLL\b/g)].length - 1] as const] : [],
    )
    expect(Object.fromEntries(uses)).toEqual({
      'src/areas/admin/components/AuditLogPanel.tsx': 1,
      'src/areas/admin/components/BoardSeatsPanel.tsx': 1,
      'src/areas/admin/components/ChampionsPanel.tsx': 1,
      'src/areas/admin/components/MembersTable.tsx': 1,
      'src/areas/admin/components/PostsPanel.tsx': 1,
      'src/areas/admin/components/TournamentList.tsx': 2,
      'src/pages/AdminEmailPage.tsx': 1,
      'src/pages/AdminPage.tsx': 1,
      'src/pages/AdminSupportPage.tsx': 1,
    })
  })
})
