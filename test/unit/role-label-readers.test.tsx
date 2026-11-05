// @vitest-environment jsdom
//
// Every page that draws the tournament_director role's label follows
// standingDirectors (D20, Q4), each through ROLE_LABELS at the moment it
// draws: the Dashboard's tools heading, the activity log's role changes and
// the Workspace page's badge, beside the Members table that
// members-table-role-title.test.tsx holds. With the switch off each reads
// "Tournament Director", as today; with it on, "Standing director"; and the
// labels of the other roles, and the "Event director" a one-event director
// is shown, stay as they are in both states. No file of the site copies the
// labels when it loads, which would freeze the switch's state at that
// moment. The real pages run through the real client, with fetch stubbed.
import { cleanup, render, screen } from '@testing-library/react'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ standingDirectors: false }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-labels' } } }) } },
}))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (key === 'standingDirectors' ? flags.standingDirectors : Reflect.get(target, key)),
    }),
  }
})

const { DashboardPage } = await import('@/pages/DashboardPage')
const { WorkspacePage } = await import('@/pages/WorkspacePage')
const { AuditLogPanel } = await import('@/areas/admin/components/AuditLogPanel')

const ROOT = join(__dirname, '../..')

interface Who {
  role: string
  id: string
  club_id?: string | null
  directed?: Array<{ id: string; name: string; date: string; status: string }>
}

let auditEntries: unknown[] = []
let seen: string[] = []

/** The member as GET /api/me answers them. */
function meAnswer(who: Who) {
  return {
    member: {
      id: who.id, email: `${who.id}@example.invalid`, full_name: 'Gerald Landry', uscf_id: null, uscf_rating: null,
      uscf_rating_updated_at: null, membership_status: 'active', membership_expiry: '2027-06-30', membership_type: null,
      guardian_id: null, uscf_expiration: null, role: who.role, club_id: who.club_id ?? null, created_at: '2025-01-04 18:00:00',
    },
    registrations: [],
    directedTournaments: who.directed ?? [],
    children: [],
  }
}

let current: Who = { role: 'member', id: 'm-none' }

beforeEach(() => {
  flags.standingDirectors = false
  auditEntries = []
  seen = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    seen.push(url)
    const path = url.split('?')[0]
    const body = path === '/api/me' ? meAnswer(current)
      : path === '/api/support' ? { tickets: [] }
        : path === '/api/me/children' ? { children: [] }
          : path === '/api/admin/audit' ? { entries: auditEntries }
            : path === '/api/tournaments' ? { tournaments: [] }
              : null
    return body
      ? new Response(JSON.stringify(body), { status: 200 })
      : new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  flags.standingDirectors = false
})

function authFor(who: Who): AuthContextValue {
  const member = meAnswer(who).member
  return {
    user: { id: who.id, email: member.email }, member, session: null, role: who.role, loading: false, memberLoading: false,
    seats: [], managedClubs: [], isBoardMember: false, assuranceLevel: 'aal1', mfaRequired: false,
    directedTournaments: who.directed ?? [], directedTournamentIds: (who.directed ?? []).map((t) => t.id),
  } as unknown as AuthContextValue
}

async function openDashboard(who: Who) {
  current = who
  render(
    <AuthContext.Provider value={authFor(who)}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes><Route path="/dashboard" element={<DashboardPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return screen.findByRole('heading', { level: 2, name: / tools$/ })
}

async function openWorkspace(who: Who) {
  current = who
  render(
    <AuthContext.Provider value={authFor(who)}>
      <MemoryRouter initialEntries={['/workspace']}>
        <Routes><Route path="/workspace" element={<WorkspacePage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return screen.findByRole('heading', { level: 1, name: 'Workspace' })
}

const DIRECTED = [{ id: 't-directed', name: 'Acadiana Open', date: '2026-12-05', status: 'upcoming' }]

describe('the Dashboard\'s tools heading', () => {
  it.each([
    [false, 'Tournament Director tools'],
    [true, 'Standing director tools'],
  ] as const)('names a tournament_director\'s tools by the role\'s label, with the switch %s: "%s"', async (on, words) => {
    flags.standingDirectors = on
    const heading = await openDashboard({ role: 'tournament_director', id: 'm-sd' })
    expect(heading.textContent).toBe(words)
    expect(document.body.textContent).not.toContain(on ? 'Tournament Director' : 'Standing director')
  })

  it.each([false, true])('keeps every other heading in both states, with the switch %s', async (on) => {
    flags.standingDirectors = on
    for (const [who, words] of [
      [{ role: 'club_rep', id: 'm-rep', club_id: 'club-k' }, 'Club Representative tools'],
      [{ role: 'lca_auditor', id: 'm-aud' }, 'LCA Auditor tools'],
      [{ role: 'lca_observer', id: 'm-obs' }, 'LCA Observer tools'],
      [{ role: 'member', id: 'm-one', directed: DIRECTED }, 'Event director tools'],
    ] as const) {
      const heading = await openDashboard(who)
      expect(heading.textContent, who.role).toBe(words)
      expect(document.body.textContent, who.role).not.toContain('Standing director')
      cleanup()
    }
  })
})

describe('the activity log\'s role changes', () => {
  /** A role change as the audit endpoint answers it. */
  const change = (id: string, from: string, to: string) => ({
    id, actor_id: 'm-admin', actor_email: 'admin@example.invalid', action: 'role_change', target_member_id: 'm-sd',
    target_label: 'Gerald Landry', detail: JSON.stringify({ from, to }), created_at: '2026-11-05 19:00:00',
  })

  /** The line under a row that gives who made the change and what it was: "by <email> · <detail>". */
  const lineEndingWith = (detail: string) => (_: string, el: Element | null) =>
    el?.tagName === 'P' && (el.textContent ?? '') === `by admin@example.invalid · ${detail}`

  it.each([
    [false, 'Member → Tournament Director', 'Tournament Director → Club Representative'],
    [true, 'Member → Standing director', 'Standing director → Club Representative'],
  ] as const)('names the role on both sides of a change by its label, with the switch %s', async (on, granted, taken) => {
    flags.standingDirectors = on
    auditEntries = [change('a1', 'member', 'tournament_director'), change('a2', 'tournament_director', 'club_rep'), change('a3', 'member', 'lca_officer')]
    render(<AuditLogPanel />)
    expect(await screen.findByText(lineEndingWith(granted))).toBeTruthy()
    expect(screen.getByText(lineEndingWith(taken))).toBeTruthy()
    // A change between two other roles reads as it does today.
    expect(screen.getByText(lineEndingWith('Member → LCA Officer'))).toBeTruthy()
    expect(document.body.textContent).not.toContain(on ? 'Tournament Director' : 'Standing director')
    expect(seen.filter((u) => u.startsWith('/api/admin/audit'))).not.toEqual([])
  })

  it('keeps a role it does not know as written, in both states', async () => {
    for (const on of [false, true]) {
      flags.standingDirectors = on
      auditEntries = [change('a4', 'guest', 'tournament_director')]
      render(<AuditLogPanel />)
      expect(await screen.findByText(lineEndingWith(`guest → ${on ? 'Standing director' : 'Tournament Director'}`))).toBeTruthy()
      cleanup()
    }
  })
})

describe('the Workspace page\'s badge', () => {
  it.each([
    [false, 'Tournament Director'],
    [true, 'Standing director'],
  ] as const)('is the role\'s label for a tournament_director, with the switch %s: "%s"', async (on, words) => {
    flags.standingDirectors = on
    await openWorkspace({ role: 'tournament_director', id: 'm-sd' })
    expect(screen.getByText(words, { selector: 'span' })).toBeTruthy()
  })

  it.each([false, true])('is "Event director" for a member who directs an event, and "Club Representative" for a club rep, with the switch %s', async (on) => {
    flags.standingDirectors = on
    await openWorkspace({ role: 'member', id: 'm-one', directed: DIRECTED })
    expect(screen.getByText('Event director', { selector: 'span' })).toBeTruthy()
    expect(screen.queryByText('Standing director')).toBeNull()
    cleanup()
    await openWorkspace({ role: 'club_rep', id: 'm-rep', club_id: 'club-k' })
    expect(screen.getByText('Club Representative', { selector: 'span' })).toBeTruthy()
    expect(screen.queryByText('Standing director')).toBeNull()
  })
})

describe('no file of the site copies the labels when it loads', () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return sourceFiles(path)
      return /\.(ts|tsx)$/.test(name) ? [path] : []
    })
  }
  const readers = sourceFiles(join(ROOT, 'src'))
    .map((path) => ({ file: relative(ROOT, path).split('\\').join('/'), text: readFileSync(path, 'utf8') }))
    .filter(({ text }) => /\bROLE_LABELS\b/.test(text))
  /** Every use of the name outside its import line and its own definition. */
  const uses = readers.flatMap(({ file, text }) => text.split('\n')
    .map((line, i) => ({ file, line: i + 1, text: line }))
    .filter(({ text: l }) => /\bROLE_LABELS\b/.test(l) && !/^\s*import\b/.test(l) && !/^export const ROLE_LABELS\b/.test(l) && !/^\s*\/\//.test(l)))

  it('finds the five readers the record names, in four files', () => {
    expect([...new Set(uses.map((u) => u.file))].sort()).toEqual([
      'src/areas/admin/components/AuditLogPanel.tsx',
      'src/areas/admin/components/MembersTable.tsx',
      'src/pages/DashboardPage.tsx',
      'src/pages/WorkspacePage.tsx',
    ])
    expect(uses).toHaveLength(5)
  })

  it('reads a label by its role each time, never spreading, listing or cloning the record, and never into a value made when the file loads', () => {
    for (const use of uses) {
      const where = `${use.file}:${use.line}`
      expect(use.text, where).toMatch(/\bROLE_LABELS\[/)
      expect(use.text, where).not.toMatch(/\.\.\.\s*ROLE_LABELS\b|Object\.\w+\(\s*ROLE_LABELS\b|JSON\.\w+\(\s*ROLE_LABELS\b|structuredClone\(\s*ROLE_LABELS\b/)
      // A value made when the file loads starts at the line's first column.
      expect(use.text, where).not.toMatch(/^(export\s+)?(const|let|var)\s/)
    }
  })

  it('keeps the getter the one place the switch picks the role\'s label', () => {
    const roles = readFileSync(join(ROOT, 'src/areas/admin/roles.ts'), 'utf8')
    expect(roles).toMatch(/get tournament_director\(\) \{\n\s+return FEATURES\.standingDirectors \? 'Standing director' : 'Tournament Director'\n\s+\}/)
    for (const { file, text } of readers.filter((r) => r.file !== 'src/areas/admin/roles.ts')) {
      expect(text, file).not.toContain("'Standing director'")
    }
  })
})
