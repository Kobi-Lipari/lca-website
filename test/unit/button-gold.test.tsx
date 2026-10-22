// @vitest-environment jsdom
//
// The Button's gold variant (WS01 step 26): gold fill, navy words, never
// white on gold. It draws GOLD_BUTTON's classes, read from src/lib/brand.ts,
// so the pages that put that string on a link or a plain element and the
// Button can never drift apart; GOLD_BUTTON itself stays the quoted literal
// it was, for its eighteen importers. The six variants the Button had keep
// their classes to the letter: changing the shared primitive reaches every
// page, and test/a11y/baseline.ts measures the first Button on four routes.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { twMerge } from 'tailwind-merge'
import { afterEach, describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'
import { GOLD_BUTTON } from '@/lib/brand'
import { contrast } from './helpers/cssTokens'
import { goldButton } from './helpers/jsxClasses'
import { tsxFiles } from '../../scripts/codemods/semantic-colours'

afterEach(cleanup)

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** The Button's base classes and its six variants as they were before step 26, to the letter. */
const BASE = "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
const SIZE = 'h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2'
const VARIANTS = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/80',
  outline: 'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
  ghost: 'hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50',
  destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40',
  link: 'text-primary underline-offset-4 hover:underline',
} as const

describe('the gold variant', () => {
  it('draws GOLD_BUTTON\'s classes: the gold fill, its hover and navy words in a heavier weight', () => {
    render(<Button variant="gold">Join the waitlist</Button>)
    const button = screen.getByRole('button', { name: 'Join the waitlist' })
    expect(button.getAttribute('data-variant')).toBe('gold')
    expect(button.getAttribute('data-slot')).toBe('button')
    expect(button.className).toBe(twMerge(`${BASE} ${GOLD_BUTTON} ${SIZE}`))
    for (const cls of GOLD_BUTTON.split(' ')) expect(button.className.split(' '), cls).toContain(cls)
  })

  it('never puts white or the ground\'s colour on gold: its words are the navy that stays navy in every look', () => {
    render(<Button variant="gold">Join the waitlist</Button>)
    const classes = screen.getByRole('button').className.split(' ')
    const words = classes.filter((c) => /^(?:[\w-]+:)*text-(?!sm$|xs$|base$|lg$)/.test(c))
    expect(words).toEqual(['text-brand-navy'])
    expect(classes).not.toContain('text-white')
    expect(classes).not.toContain('text-primary-foreground')
    expect(classes).not.toContain('font-medium')
    // Navy on the brand gold, 6.51:1, the pairing the brief allows on gold.
    expect(contrast('#1a2744', '#c8a94a')).toBeCloseTo(6.51, 2)
  })

  it('keeps its words navy when a caller adds classes, as the pages that pass GOLD_BUTTON to a Button do', () => {
    render(<Button variant="gold" size="sm" className="h-7 text-xs">Register</Button>)
    const classes = screen.getByRole('button').className.split(' ')
    expect(classes).toContain('text-brand-navy')
    expect(classes).toContain('bg-lca-gold')
    expect(classes).toContain('text-xs')
  })

  it('reads the string from src/lib/brand.ts, so the two are one', () => {
    const source = read('src/components/ui/button.tsx')
    expect(source).toContain('import { GOLD_BUTTON } from "@/lib/brand"')
    expect(source).toContain('        gold: GOLD_BUTTON,\n')
    expect(goldButton()).toBe(GOLD_BUTTON)
  })
})

describe('GOLD_BUTTON stays as it was', () => {
  it('is the same quoted literal', () => {
    expect(GOLD_BUTTON).toBe('bg-lca-gold font-semibold text-brand-navy hover:bg-lca-gold/90')
    expect(read('src/lib/brand.ts')).toContain(`export const GOLD_BUTTON =\n  '${GOLD_BUTTON}'\n`)
  })

  it('is imported by the same eighteen files as before, and by the Button now', () => {
    const importers = tsxFiles(ROOT).filter((file) => /import \{[^}]*\bGOLD_BUTTON\b[^}]*\} from '@\/lib\/brand'/.test(read(file)))
    expect(importers).toHaveLength(18)
    expect(importers).not.toContain('src/components/ui/button.tsx')
    expect(read('src/components/ui/button.tsx')).toMatch(/import \{ GOLD_BUTTON \} from "@\/lib\/brand"/)
  })
})

describe('the six variants the Button had keep their classes to the letter', () => {
  it('has exactly them and the gold one', () => {
    const source = read('src/components/ui/button.tsx')
    const block = source.slice(source.indexOf('variant: {'), source.indexOf('size: {'))
    const names = [...block.matchAll(/^ {8}([a-z]+):/gm)].map((m) => m[1])
    expect(names).toEqual(['default', 'outline', 'secondary', 'ghost', 'destructive', 'link', 'gold'])
  })

  it.each(Object.entries(VARIANTS))('%s draws what it drew', (variant, classes) => {
    render(<Button variant={variant as keyof typeof VARIANTS}>Words</Button>)
    const button = screen.getByRole('button', { name: 'Words' })
    expect(button.className).toBe(twMerge(`${BASE} ${classes} ${SIZE}`))
    expect(button.getAttribute('data-variant')).toBe(variant)
  })

  it('draws the default variant when none is given', () => {
    render(<Button>Register</Button>)
    expect(screen.getByRole('button').className).toBe(twMerge(`${BASE} ${VARIANTS.default} ${SIZE}`))
  })
})
