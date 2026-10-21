// src/pages/fixtures/ScopeFixturePage.tsx
//
// A test page for the accessibility suite (npm run test:a11y), at
// /__fixtures/:name, in the accessibility test build only: src/App.tsx
// registers the route behind import.meta.env.MODE, so the site's own build
// carries neither the route nor this file. Each name draws the shared
// controls in one look through ThemeScope (data-theme, "" for base), so the
// browser tests measure colours, contrast and layout in each look: buttons,
// a text field, status badges, a table and figures in the monospace face,
// then the base components (BaseComponents, below) and, in the scholastic
// look, the grade band tiles. The colours change only in a build with
// newLook on. test/a11y/scope-switch.spec.ts switches data-theme on the
// container in place to show a change of look moves nothing, and
// test/a11y/components.spec.ts checks the base components in every look.
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DateBlock } from '@/components/DateBlock'
import { ScrollPanel } from '@/components/ScrollPanel'
import { StatusBadge, StatusDot } from '@/components/StatusBadge'
import { ThemeScope } from '@/components/ThemeScope'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePageTitle } from '@/hooks/usePageTitle'
import { BADGE_STATUSES } from '@/lib/badgeStatus'
import type { ThemeScopeName } from '@/lib/themeScopes'

/** Fixture name to the look its container is drawn in. */
const FIXTURE_SCOPES: Record<string, ThemeScopeName> = {
  base: 'base',
  heritage: 'heritage',
  scholastic: 'scholastic',
  live: 'live',
}

/**
 * The Looks-6 grade band colours: each band's hue as text on its own tile,
 * with the band's words beside the colour, never the colour alone. The gold
 * tile marks no band. As on the board's "Gold tile" swatch it carries dark
 * gold text, #705718 (6.08:1 on the tile); in the scholastic look that is
 * --status-soon, the one token there with that colour. The band names take
 * an en dash, as the boards write them ("K" + RANGE + "5"); it is written as
 * an escape so this file holds no dash character
 * (browser-test-wiring.test.ts).
 */
const RANGE = '\u2013'
const GRADE_BAND_TILES = [
  { band: `K${RANGE}3`, hue: 'Coral', className: 'bg-(--coral-tile) text-(--coral)' },
  { band: `K${RANGE}5`, hue: 'Mint', className: 'bg-(--mint-tile) text-(--mint)' },
  { band: `K${RANGE}8`, hue: 'Sky', className: 'bg-(--sky-tile) text-(--sky)' },
  { band: `K${RANGE}12`, hue: 'Grape', className: 'bg-(--grape-tile) text-(--grape)' },
] as const

const STANDINGS = [
  { place: 1, name: 'Player One', score: '3½' },
  { place: 2, name: 'Player Two', score: '3' },
  { place: 3, name: 'Player Three', score: '2½' },
]

export function ScopeFixturePage() {
  const { name = '' } = useParams()
  const known = Object.prototype.hasOwnProperty.call(FIXTURE_SCOPES, name)
  usePageTitle(known ? `Fixture: ${name}` : 'Fixture not found')

  if (!known) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold">No fixture named "{name}"</h1>
        <p className="mt-2">These fixtures exist:</p>
        <ul className="mt-2 list-disc pl-6">
          {Object.keys(FIXTURE_SCOPES).map((n) => (
            <li key={n}>
              <Link className="underline" to={`/__fixtures/${n}`}>{n}</Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <ThemeScope scope={FIXTURE_SCOPES[name]} layout="box" data-fixture={name} className="bg-background text-foreground">
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-12">
        <header>
          <h1 className="text-3xl font-bold">Fixture: {name}</h1>
          <p className="mt-2 text-muted-foreground">
            Sample controls in the {name} look. Sat, Oct 24 at 7:00 PM, rated by US Chess.
          </p>
        </header>

        <section aria-labelledby="fixture-buttons">
          <h2 id="fixture-buttons" className="text-xl font-semibold">Buttons</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button>Register</Button>
            <Button variant="outline">See details</Button>
            <Button variant="secondary">Add to calendar</Button>
            <Button variant="link">Read the rules</Button>
          </div>
        </section>

        <section aria-labelledby="fixture-form">
          <h2 id="fixture-form" className="text-xl font-semibold">Text field</h2>
          <div className="mt-3 max-w-sm space-y-2">
            <Label htmlFor="fixture-input">Your name</Label>
            <Input id="fixture-input" placeholder="First and last name" />
          </div>
        </section>

        <section aria-labelledby="fixture-status">
          <h2 id="fixture-status" className="text-xl font-semibold">Status</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <StatusBadge tone="emerald" on="light"><span data-status="open">Registration open</span></StatusBadge>
            <StatusBadge tone="gold" on="light"><span data-status="soon">Opens soon</span></StatusBadge>
            <StatusBadge tone="muted" on="light"><span data-status="closed">Registration closed</span></StatusBadge>
          </div>
        </section>

        <BaseComponents />

        <section aria-labelledby="fixture-table">
          <h2 id="fixture-table" className="text-xl font-semibold">Standings</h2>
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Place</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STANDINGS.map((row) => (
                <TableRow key={row.place}>
                  <TableCell>{row.place}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{row.score}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>

        {name === 'scholastic' && (
          <section aria-labelledby="fixture-bands">
            <h2 id="fixture-bands" className="text-xl font-semibold">Grade band colors</h2>
            <p className="mt-2 text-muted-foreground">
              Each color marks one grade band and always sits beside the band's name.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {GRADE_BAND_TILES.map((tile) => (
                <li key={tile.band} data-band={tile.band} className={`rounded-lg px-3 py-2 ${tile.className}`}>
                  <span className="block font-semibold">{tile.band}</span>
                  <span className="block text-sm">{tile.hue}</span>
                </li>
              ))}
              <li data-band="gold" className="rounded-lg bg-(--gold-tile) px-3 py-2 text-status-soon">
                <span className="block font-semibold">Gold tile</span>
                <span className="block text-sm">Tiles</span>
              </li>
            </ul>
          </section>
        )}
      </div>
    </ThemeScope>
  )
}

/** The quick filters the chips show, with the count each would give; Scholastic can also be removed. */
const QUICK_FILTERS: ReadonlyArray<{ label: string; count?: number; removable?: boolean }> = [
  { label: 'This month' },
  { label: 'Classical', count: 2 },
  { label: 'Scholastic', count: 2, removable: true },
  { label: 'Near me' },
]

/** The rows of the scroll panel, each a box to tick: more than the panel shows at once, so it scrolls. */
const SETUP_STEPS = [
  'Event name and dates',
  'Venue and parking',
  'Sections and rating limits',
  'Entry fees',
  'Prizes',
  'Round schedule',
  'Directors',
  'Registration window',
  'Rating with US Chess',
  'Payments',
  'Review and publish',
]

/**
 * The base components later pages are built from (WS01 step 26), in the look
 * of the container: a StatusBadge for every status, in its default words and
 * in words of its own, each carrying data-status, and the three StatusDots;
 * the gold Button; filter chips that toggle, with and without a count, one
 * that can also be removed, and an applied filter that can only be removed;
 * date blocks for a bare date, a Louisiana wall-clock time and an instant
 * (with the year); and a scroll panel of steps to tick under a header.
 */
function BaseComponents() {
  const [pressed, setPressed] = useState<Record<string, boolean>>({ 'This month': true })
  const [removed, setRemoved] = useState<string[]>([])
  const shown = (label: string) => !removed.includes(label)
  const remove = (label: string) => () => setRemoved((r) => [...r, label])

  return (
    <>
      <section aria-labelledby="fixture-statuses">
        <h2 id="fixture-statuses" className="text-xl font-semibold">Every status</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {BADGE_STATUSES.map((status) => (
            <StatusBadge key={status} status={status} on="light" />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <StatusBadge status="soon" on="light">Opens Mon, Oct 12</StatusBadge>
          <StatusBadge status="live" on="light">Live · Round 3</StatusBadge>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <StatusDot regStatus="open" />
          <StatusDot regStatus="draft" />
          <StatusDot regStatus="closed" />
        </div>
      </section>

      <section aria-labelledby="fixture-gold">
        <h2 id="fixture-gold" className="text-xl font-semibold">Gold button</h2>
        <div className="mt-3">
          <Button variant="gold">Join the waitlist</Button>
        </div>
      </section>

      <section aria-labelledby="fixture-chips">
        <h2 id="fixture-chips" className="text-xl font-semibold">Filter chips</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {QUICK_FILTERS.filter((f) => shown(f.label)).map((f) => (
            <FilterChip
              key={f.label}
              label={f.label}
              count={f.count}
              pressed={pressed[f.label] === true}
              onPressedChange={(on) => setPressed((p) => ({ ...p, [f.label]: on }))}
              onRemove={f.removable ? remove(f.label) : undefined}
            />
          ))}
          {shown('Next 3 months') && <FilterChip label="Next 3 months" onRemove={remove('Next 3 months')} />}
        </div>
      </section>

      <section aria-labelledby="fixture-dates">
        <h2 id="fixture-dates" className="text-xl font-semibold">Dates</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <DateBlock value="2026-10-24" />
          <DateBlock value="2026-11-07T09:00" />
          <DateBlock value="2026-12-05T03:00:00Z" year />
        </div>
      </section>

      <section aria-labelledby="fixture-scroll">
        <h2 id="fixture-scroll" className="text-xl font-semibold">Scroll panel</h2>
        <ScrollPanel
          label="Setup steps"
          header={<p className="px-4 py-2 text-sm font-semibold">Setup steps</p>}
          className="mt-3 max-h-48"
        >
          <ol className="divide-y divide-hairline">
            {SETUP_STEPS.map((step, i) => (
              <li key={step}>
                <label className="flex items-center gap-3 px-4 py-2 text-sm">
                  <input type="checkbox" className="size-4 accent-ink" />
                  {i + 1}. {step}
                </label>
              </li>
            ))}
          </ol>
        </ScrollPanel>
      </section>
    </>
  )
}
