// @vitest-environment jsdom
//
// The shared Button after WS01 step 26 added its gold variant, at its edges.
//
// - Every one of the six variants it had, in every one of its eight sizes,
//   draws the classes it drew before the step, to the letter (the strings
//   below are the ones button.tsx held at a74f221), so no page's Button
//   changes; the defaults are still the default variant at the default size.
// - The gold variant keeps its navy words and gold fill in every size, as a
//   link (asChild) too, and is never white on gold.
// - GOLD_BUTTON's importers are the same eighteen files, each still reading
//   the string under the name it used, and none of them has moved to the
//   variant: they render as before.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { twMerge } from 'tailwind-merge'
import { afterEach, describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'
import { GOLD_BUTTON } from '@/lib/brand'
import { tsxFiles } from '../../scripts/codemods/semantic-colours'

afterEach(cleanup)

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** button.tsx at a74f221: the base, the six variants and the eight sizes, to the letter. */
const BASE = "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
const VARIANTS = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/80',
  outline: 'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
  ghost: 'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
  destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
  link: 'text-primary underline-offset-4 hover:underline',
} as const
const SIZES = {
  default: 'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
  xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
  sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
  lg: 'h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
  icon: 'size-8',
  'icon-xs': "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
  'icon-sm': 'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
  'icon-lg': 'size-9',
} as const
type Variant = keyof typeof VARIANTS
type Size = keyof typeof SIZES

/** What a Button drew before the step for a variant and a size: cva joins the three, and cn merges them. */
const before = (variant: Variant, size: Size) => twMerge(`${BASE} ${VARIANTS[variant]} ${SIZES[size]}`)

/** The eighteen files that imported GOLD_BUTTON at a74f221, and the name each reads it by. */
const IMPORTERS: Record<string, 'GOLD' | 'GOLD_BUTTON'> = {
  'src/areas/admin/components/AdminAnnouncementPanel.tsx': 'GOLD_BUTTON',
  'src/areas/admin/components/ChampionsPanel.tsx': 'GOLD',
  'src/areas/admin/components/DirectorsModal.tsx': 'GOLD',
  'src/areas/admin/components/PostsPanel.tsx': 'GOLD',
  'src/areas/admin/components/TournamentList.tsx': 'GOLD',
  'src/areas/admin/components/TournamentWizard.tsx': 'GOLD',
  'src/areas/governance/components/GovernanceDocuments.tsx': 'GOLD',
  'src/areas/households/components/FamilyCard.tsx': 'GOLD',
  'src/areas/households/components/FamilyRegistrationPanel.tsx': 'GOLD',
  'src/pages/AdminEmailPage.tsx': 'GOLD',
  'src/pages/AdminPage.tsx': 'GOLD',
  'src/pages/AnnualMeetingPage.tsx': 'GOLD_BUTTON',
  'src/pages/BoardInboxPage.tsx': 'GOLD',
  'src/pages/BoardPage.tsx': 'GOLD',
  'src/pages/NewsPostPage.tsx': 'GOLD',
  'src/pages/ScannerPage.tsx': 'GOLD_BUTTON',
  'src/pages/ScholasticPage.tsx': 'GOLD',
  'src/pages/WorkspacePage.tsx': 'GOLD',
}

describe('the six variants, in every size, draw what they drew', () => {
  const cases = (Object.keys(VARIANTS) as Variant[]).flatMap((variant) => (Object.keys(SIZES) as Size[]).map((size) => [variant, size] as const))

  it('covers six variants in eight sizes', () => {
    expect(cases).toHaveLength(48)
  })

  it.each(cases)('%s at size %s', (variant, size) => {
    render(<Button variant={variant} size={size}>Words</Button>)
    const button = screen.getByRole('button')
    expect(button.className).toBe(before(variant, size))
    expect(button.getAttribute('data-variant')).toBe(variant)
    expect(button.getAttribute('data-size')).toBe(size)
  })

  it('takes the default variant at the default size when given neither, as before', () => {
    render(<Button>Register</Button>)
    const button = screen.getByRole('button')
    expect(button.className).toBe(before('default', 'default'))
    expect([button.getAttribute('data-variant'), button.getAttribute('data-size')]).toEqual(['default', 'default'])
  })

  it('the sizes block of button.tsx is the one it was, and nothing was added to it', () => {
    const source = read('src/components/ui/button.tsx')
    const block = source.slice(source.indexOf('size: {'), source.indexOf('defaultVariants'))
    const names = [...block.matchAll(/^ {8}"?([a-z-]+)"?:/gm)].map((m) => m[1])
    expect(names).toEqual(Object.keys(SIZES))
    expect(source).toContain('defaultVariants: {\n      variant: "default",\n      size: "default",\n    },')
  })
})

describe('the gold variant in every size', () => {
  it.each(Object.keys(SIZES) as Size[])('at size %s keeps the gold fill and the navy words, never white on gold', (size) => {
    render(<Button variant="gold" size={size}>Join the waitlist</Button>)
    const classes = screen.getByRole('button').className.split(' ')
    for (const cls of GOLD_BUTTON.split(' ')) expect(classes, cls).toContain(cls)
    expect(classes).not.toContain('text-white')
    expect(classes).not.toContain('text-primary-foreground')
    expect(classes).not.toContain('bg-primary')
    // One words colour, the navy, and one weight, GOLD_BUTTON's.
    expect(classes.filter((c) => /^text-(?:white|black|primary|brand|lca|ink|foreground|gold)/.test(c))).toEqual(['text-brand-navy'])
    expect(classes.filter((c) => /^font-(?:medium|semibold|bold)$/.test(c))).toEqual(['font-semibold'])
  })

  it('draws the same on a link given through asChild, as the pages that link to registration would', () => {
    render(
      <Button variant="gold" asChild>
        <a href="/tournaments/fx-t-open">Register</a>
      </Button>,
    )
    const link = screen.getByRole('link', { name: 'Register' })
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/tournaments/fx-t-open')
    expect(link.getAttribute('data-variant')).toBe('gold')
    for (const cls of GOLD_BUTTON.split(' ')) expect(link.className.split(' '), cls).toContain(cls)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('stays a button that submits nothing unless told to, like the others', () => {
    render(<Button variant="gold" type="button" disabled>Join the waitlist</Button>)
    const button = screen.getByRole('button') as HTMLButtonElement
    expect(button.type).toBe('button')
    expect(button.disabled).toBe(true)
    expect(button.className.split(' ')).toContain('disabled:opacity-50')
  })
})

describe('GOLD_BUTTON\'s eighteen importers render as before', () => {
  it('are the same eighteen files, and only button.tsx imports it besides', () => {
    const importers = tsxFiles(ROOT).filter((file) => /\bGOLD_BUTTON\b/.test(read(file)) && file !== 'src/lib/brand.ts')
    expect(importers.sort()).toEqual([...Object.keys(IMPORTERS), 'src/components/ui/button.tsx'].sort())
  })

  it.each(Object.entries(IMPORTERS))('%s still reads the string as %s, and draws no gold variant', (file, name) => {
    const source = read(file)
    const expected = name === 'GOLD' ? /import \{[^}]*\bGOLD_BUTTON as GOLD\b[^}]*\} from '@\/lib\/brand'/ : /import \{[^}]*\bGOLD_BUTTON\b(?! as)[^}]*\} from '@\/lib\/brand'/
    expect(source).toMatch(expected)
    // Still read: the name is used beyond its import.
    expect(source.split(new RegExp(`\\b${name}\\b`)).length - 1, name).toBeGreaterThan(1)
    expect(source).not.toMatch(/variant=["'{]+gold/)
  })
})
