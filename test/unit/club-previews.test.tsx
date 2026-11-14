// @vitest-environment jsdom
//
// The club editor's preview column (WS09 step 8): the search result, the
// share card, the directory card and the page's checklist, each drawn from
// the club's own words as the keeper types, mounted here on their own and in
// the editor. Held here: the title and the description are the page's own,
// made by domain/clubs/pageMeta.ts, the description at most 155 characters;
// the share card is the logo, else the initials in white on navy, and draws
// a logo only from the club's own stored path on this site; the directory
// card is at most three lines, with no computed date, no "Checked" month, no
// claim about a week, and no colour, logo, initials, link or button; the
// checklist says each item's state in words; each preview reads in words to
// a screen reader; no preview makes a request; and in the editor the column
// stands outside the form, sticky beside it at wide widths and folded under
// one Preview button on a phone, which says whether it is open, keeps the
// focus and is 44 pixels tall. Every name, address and club here is made up.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { PAGE_DESCRIPTION_MAX, clubPageDescription, clubPageTitle } from '@domain/clubs/pageMeta'
import { CardPreview } from '@/areas/clubs/components/CardPreview'
import { PageChecklist } from '@/areas/clubs/components/PageChecklist'
import { SearchPreview } from '@/areas/clubs/components/SearchPreview'
import { SharePreview } from '@/areas/clubs/components/SharePreview'
import { clubInitials, ownColour, ownLogo, pageChecklist } from '@/areas/clubs/previews'
import { builder, setBy } from './helpers/tailwindPx'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

const { ClubEditor } = await import('@/areas/clubs/components/ClubEditor')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
/** A file's code with its comments taken out. */
const codeOf = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const ABOUT = 'A friendly made-up club for casual and rated games, where beginners sit down with strong players and nobody minds a slow move or a question about the rules.'
const STATEMENT = 'Tuesdays from 7:00 PM at Example Library, casual games.'

const CLUB = {
  id: 'example-chess-club', name: 'Example Chess Club', city: 'Example City', location: 'Example Library', description: ABOUT,
  meeting_schedule: STATEMENT, contact_email: 'club@example.org', created_at: '2026-01-01 12:00:00', color: '#c8a94a', image_url: null,
  region: 'Bayou Region', latitude: 30.1, longitude: -91.2, slug: 'example-chess', about_text: ABOUT, how_we_meet_text: STATEMENT,
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player One', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: null, told_by: null, last_confirmed_at: null, confirmed_by: null,
}
const PLACE = { id: 1, name: 'Example Library', street: '1 Example Street', note: null, latitude: 30.1, longitude: -91.2 }

const fetched: string[] = []
beforeEach(() => {
  fetched.length = 0
  window.localStorage.setItem('lca-club-editor-help', 'shown')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    fetched.push(url)
    return new Response('{}', { status: 404 })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

/** The words a part of the page gives, as a screen reader reads them in order, with a space between pieces. */
function wordsOf(el: Element): string {
  const parts: string[] = []
  const walk = (node: Node) => {
    if (node instanceof HTMLElement && node.getAttribute('aria-hidden') === 'true') return
    if (node instanceof HTMLElement && node.getAttribute('role') === 'img') {
      parts.push(node.getAttribute('aria-label') ?? '')
      return
    }
    if (node instanceof HTMLImageElement) {
      parts.push(node.alt)
      return
    }
    if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent ?? '')
    node.childNodes.forEach(walk)
  }
  walk(el)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function editor(person: 'rep' | 'admin' = 'rep', club: Record<string, unknown> = CLUB) {
  const role = person === 'admin' ? 'lca_admin' : 'club_rep'
  const auth = {
    user: { id: 'm-example' }, member: { id: 'm-example', role, club_id: CLUB.id, full_name: 'Player Two' }, session: null, role,
    loading: false, memberLoading: false, seats: [], managedClubs: [], directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <ClubEditor
          club={club as never} places={[PLACE]} isAdmin={person === 'admin'} showAdminFields={person === 'admin'} viewOnly={false} onSaved={() => {}}
        />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('the search preview', () => {
  it('the title and description are the page\'s', () => {
    render(<SearchPreview name="Example Chess Club" city="Example City" about={ABOUT} statement={STATEMENT} address="example-chess" />)
    const result = screen.getByRole('region', { name: 'How your page shows up in a search' })
    const title = clubPageTitle('Example Chess Club', 'Example City')
    expect(title).toBe('Example Chess Club · Chess club in Example City, Louisiana · Louisiana Chess Association')
    expect(within(result).getByText(title)).toBeTruthy()
    expect(within(result).getByText(clubPageDescription(ABOUT, STATEMENT))).toBeTruthy()
    // A screen reader reads it as a site, a title and a description.
    expect([...result.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(['Site', 'Title', 'Description'])
    expect(within(result).getByText('Louisiana Chess Association · louisianachess.org › clubs › example-chess')).toBeTruthy()
    // The preview reads the one rule the server page will use.
    expect(read('src/areas/clubs/components/SearchPreview.tsx')).toContain('from \'@domain/clubs/pageMeta\'')
  })

  it('155 characters at most, About cut and the meeting\'s words kept whole', () => {
    const long = `${ABOUT} ${ABOUT}`
    render(<SearchPreview name="Example Chess Club" city="Example City" about={long} statement={STATEMENT} address="example-chess" />)
    const description = screen.getByRole('region', { name: 'How your page shows up in a search' }).querySelectorAll('dd')[2].textContent ?? ''
    expect(description).toBe(clubPageDescription(long, STATEMENT))
    expect(description.length).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX)
    expect(description.length).toBeGreaterThan(100)
    expect(description.endsWith(`… ${STATEMENT}`)).toBe(true)
    expect(long.startsWith(description.slice(0, description.indexOf('…')))).toBe(true)
    cleanup()
    // With no meeting's words, About alone is cut.
    render(<SearchPreview name="Example Chess Club" city="Example City" about={long} statement="" address="example-chess" />)
    const alone = screen.getByRole('region', { name: 'How your page shows up in a search' }).querySelectorAll('dd')[2].textContent ?? ''
    expect(alone.endsWith('…')).toBe(true)
    expect(long.startsWith(alone.slice(0, -1))).toBe(true)
  })

  it('says there is no description yet when About and the meeting\'s words are both empty', () => {
    render(<SearchPreview name="Example Chess Club" city="" about="" statement="  " address="example-chess-club" />)
    const result = screen.getByRole('region', { name: 'How your page shows up in a search' })
    expect(within(result).getByText('Example Chess Club · Chess club in Louisiana · Louisiana Chess Association')).toBeTruthy()
    expect(within(result).getByText('No description yet.')).toBeTruthy()
  })
})

describe('the share preview', () => {
  it('initials on navy with no logo', () => {
    render(<SharePreview name="Example Chess Club" city="Example City" about="" statement="" logo={null} />)
    const card = screen.getByRole('region', { name: 'When someone shares your page' })
    const tile = within(card).getByRole('img', { name: 'The initials EC in white on navy' })
    expect(tile.className).toContain('bg-brand-navy')
    expect(tile.textContent).toBe('EC')
    expect(card.querySelector('img')).toBeNull()
    expect(within(card).getByText('Example Chess Club · Chess club in Example City, Louisiana · Louisiana Chess Association')).toBeTruthy()
    expect(wordsOf(card)).toBe('When someone shares your page The initials EC in white on navy Site louisianachess.org Title Example Chess Club · Chess club in Example City, Louisiana · Louisiana Chess Association Description No description yet.')
  })

  it('draws the club\'s own stored logo, and never one from another site, so it makes no request elsewhere', () => {
    render(<SharePreview name="Example Chess Club" city="Example City" about={ABOUT} statement="" logo="/api/clubs/example-chess-club/logo?v=2" />)
    const card = screen.getByRole('region', { name: 'When someone shares your page' })
    expect(within(card).getByAltText('The club\'s logo').getAttribute('src')).toBe('/api/clubs/example-chess-club/logo?v=2')
    cleanup()
    for (const elsewhere of ['https://example.org/logo.png', '//example.org/logo.png', '/\\example.org/logo.png', 'javascript:alert(1)', '']) {
      render(<SharePreview name="Example Chess Club" city="Example City" about="" statement="" logo={elsewhere} />)
      const shared = screen.getByRole('region', { name: 'When someone shares your page' })
      expect(shared.querySelector('img'), elsewhere).toBeNull()
      expect(within(shared).getByRole('img', { name: 'The initials EC in white on navy' })).toBeTruthy()
      cleanup()
    }
    expect(fetched).toEqual([])
  })

  it('makes initials from the first two words, or two letters of a name of one word', () => {
    expect(clubInitials('Sample Town Chess Club')).toBe('ST')
    expect(clubInitials('Player One Knights')).toBe('PO')
    expect(clubInitials('Example Chess Club')).toBe('EC')
    expect(clubInitials('Exampleton')).toBe('EX')
    expect(clubInitials('  the   example  club ')).toBe('TE')
    expect(clubInitials('Café Chess')).toBe('CC')
    expect(clubInitials('***')).toBe('?')
  })
})

describe('the directory card preview', () => {
  it('the card has no Checked month', () => {
    render(<CardPreview name="Example Chess Club" city="Example City" statement={STATEMENT} about={ABOUT} />)
    const card = screen.getByRole('group', { name: 'Directory card' })
    expect([...card.children].map((p) => p.textContent)).toEqual(['Example Chess Club · Example City', STATEMENT])
    expect(card.children[1].className).toContain('line-clamp-2')
    const words = card.textContent ?? ''
    expect(words).not.toMatch(/Checked|Report outdated|week|tonight|today|next meeting|meets soon/i)
    expect(words).not.toMatch(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b|\b\d{4}-\d{2}-\d{2}\b/)
    // One plain card: no colour, logo, initials, link or button.
    expect(card.querySelectorAll('img, [role="img"], a, button, [style]')).toHaveLength(0)
    expect(codeOf('src/areas/clubs/components/CardPreview.tsx')).not.toMatch(/style=|clubInitials|Date\(|toLocale|Checked/)
  })

  it('says "Schedule not listed" with the club\'s own description in grey when it has no statement, in three lines at most', () => {
    render(<CardPreview name="Example Chess Club" city="Example City" statement={'  \n '} about={`${ABOUT}\nSecond line.`} />)
    const card = screen.getByRole('group', { name: 'Directory card' })
    expect([...card.children].map((p) => p.textContent)).toEqual([
      'Example Chess Club · Example City', 'Schedule not listed · Know when they meet? Suggest an update', `${ABOUT} Second line.`,
    ])
    expect(card.children[2].className).toContain('text-muted-foreground')
    expect(card.children[2].className).toContain('line-clamp-1')
    cleanup()
    render(<CardPreview name="Example Chess Club" city="" statement="" about="" />)
    expect([...screen.getByRole('group', { name: 'Directory card' }).children].map((p) => p.textContent)).toEqual([
      'Example Chess Club', 'Schedule not listed · Know when they meet? Suggest an update',
    ])
  })
})

describe('the page\'s checklist', () => {
  it('says each item\'s state in words beside its mark, and the count done', () => {
    const items = pageChecklist({ statement: STATEMENT, pinned: true, email: '', logo: null, colour: '#c8a94a' })
    render(<PageChecklist items={items} />)
    const list = screen.getByRole('region', { name: 'Your page\'s checklist' })
    expect(within(list).getByText('2 of 5 done')).toBeTruthy()
    expect(screen.getAllByRole('listitem').map((li) => wordsOf(li))).toEqual([
      'How the club meets, in your words : Done', 'A place pinned on the map : Done', 'Email for messages : Not yet', 'Logo : Not yet', 'Club colour : Not yet',
    ])
    // The marks are for the eye alone, and no colour carries a state.
    for (const svg of list.querySelectorAll('svg')) expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(read('src/areas/clubs/components/PageChecklist.tsx')).not.toMatch(/text-(?:ok|bad|warn|destructive|green|red|amber)|style=/)
  })

  it('counts a colour as set only when it is the club\'s own, not none and not the default gold, and a logo only from the club\'s own path', () => {
    expect(ownColour(null)).toBeNull()
    expect(ownColour('#C8A94A')).toBeNull()
    expect(ownColour('gold')).toBeNull()
    expect(ownColour('#2E7D32')).toBe('#2e7d32')
    expect(ownLogo('/api/clubs/example-chess-club/logo?v=1')).toBe('/api/clubs/example-chess-club/logo?v=1')
    expect(ownLogo('https://example.org/logo.png')).toBeNull()
    const all = pageChecklist({ statement: 'x', pinned: true, email: 'club@example.org', logo: '/api/clubs/example-chess-club/logo?v=1', colour: '#2e7d32' })
    expect(all.every((i) => i.done)).toBe(true)
  })
})

describe('the preview column in the editor', () => {
  it('stands outside the form, sticky beside it at wide widths, and updates as the person types', () => {
    const { container } = editor('admin')
    const form = container.querySelector('form')!
    const column = screen.getByRole('complementary', { name: 'Preview' })
    expect(form.contains(column)).toBe(false)
    expect(form.compareDocumentPosition(column) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(column.className).toContain('lg:sticky')
    expect(column.parentElement!.className).toContain('lg:flex-row')
    expect(column.parentElement!.className).toContain('flex-col')
    for (const name of ['How your page shows up in a search', 'When someone shares your page', 'Your page\'s checklist']) expect(within(column).getByRole('region', { name })).toBeTruthy()
    expect(within(column).getByRole('group', { name: 'Directory card' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Club name'), { target: { value: 'Example Town Chess Club' } })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Example Town' } })
    // The search result and the share card both carry the new title.
    expect(within(column).getAllByText('Example Town Chess Club · Chess club in Example Town, Louisiana · Louisiana Chess Association')).toHaveLength(2)
    expect(within(column).getByText('Example Town Chess Club · Example Town')).toBeTruthy()
    // The club still has the default gold, so its colour is not yet set; a colour picked counts at once.
    expect(within(column).getByText('3 of 5 done')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Club colour'), { target: { value: '#2e7d32' } })
    expect(within(column).getByText('4 of 5 done')).toBeTruthy()
    expect(fetched).toEqual([])
  })

  it('folds under one Preview button on a phone, which says whether it is open, keeps the focus, and is 44 pixels tall', async () => {
    editor()
    const button = screen.getByRole('button', { name: 'Preview' })
    const panel = document.getElementById(button.getAttribute('aria-controls')!)!
    expect(button.closest('h2')).not.toBeNull()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.className).toContain('lg:hidden')
    expect(panel.className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'lg:block']))
    button.focus()
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(panel.className.split(' ')).not.toContain('hidden')
    expect(document.activeElement).toBe(button)
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    const css = (await builder())([...button.classList])
    expect(setBy(css, 'min-h-11', 'min-height')).toEqual({ px: 44, media: null })
    expect(button.className).toMatch(/focus-visible:ring/)
  })
})

/** Every source file under a folder, as paths from the repository's root. */
function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(ROOT, dir))) {
    const path = join(dir, name)
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...sources(path))
    else if (/\.(ts|tsx)$/.test(name)) out.push(path)
  }
  return out
}

const PREVIEWS = ['SearchPreview', 'SharePreview', 'CardPreview', 'PageChecklist']

describe('the previews\' sources', () => {
  it('are reached only through the editor\'s own chunk', () => {
    const holders: string[] = []
    for (const file of sources('src')) {
      const text = read(file)
      for (const name of [...PREVIEWS.map((p) => `components/${p}`), 'previews']) {
        if (new RegExp(`^\\s*(import|export)\\b[^\\n]*from '@/areas/clubs/${name}'`, 'm').test(text)) holders.push(`${relative('src', file)} ${name}`)
      }
    }
    expect(holders.filter((h) => !/^areas\/clubs\/components\/(ClubEditor|SharePreview|PageChecklist)\.tsx /.test(h))).toEqual([])
  })

  it('make no request, use no inline style or club colour as words, no gold word, and only the site\'s tokens', () => {
    const RAW = /(^|:)(bg|text|border|ring|fill|stroke)-(black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?(\/\d+)?$|bg-white|\[#/
    for (const file of [...PREVIEWS.map((p) => `src/areas/clubs/components/${p}.tsx`), 'src/areas/clubs/previews.ts', 'domain/clubs/pageMeta.ts']) {
      const text = read(file)
      expect(text, file).not.toMatch(/\bfetch\(|XMLHttpRequest|style=\{|clubTextColor|clubTextOnDark|text-lca-gold|text-gold\b/)
      for (const token of text.match(/['"` ]([a-z:-]+-[\w/[\]#-]+)(?=['"` ])/g) ?? []) expect(RAW.test(token.trim().replace(/^['"` ]/, '')), `${file} ${token}`).toBe(false)
    }
    // White words appear on the navy tile alone.
    expect(read('src/areas/clubs/components/SharePreview.tsx').match(/text-white/g)).toHaveLength(1)
    expect(read('src/areas/clubs/components/SharePreview.tsx')).toContain('bg-brand-navy')
  })

  it('write plain words: no long or short dash, no old name for US Chess, and nothing about how they were made', () => {
    const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
    const OLD_NAME = new RegExp(['us', 'cf'].join(''), 'i')
    const MADE_BY = new RegExp(`\\b(${[['Cl', 'aude'], ['Anthr', 'opic'], ['Chat', 'GPT'], ['Ope', 'nAI'], ['L', 'LM'], ['co', 'pilot']].map((p) => p.join('')).join('|')})\\b`, 'i')
    for (const file of [
      ...PREVIEWS.map((p) => `src/areas/clubs/components/${p}.tsx`), 'src/areas/clubs/previews.ts', 'domain/clubs/pageMeta.ts',
      'test/unit/club-previews.test.tsx', 'test/unit/page-meta.test.ts',
    ]) {
      const text = read(file)
      expect(text, file).not.toMatch(DASH)
      expect(text, file).not.toMatch(OLD_NAME)
      expect(text, file).not.toMatch(MADE_BY)
    }
  })
})
