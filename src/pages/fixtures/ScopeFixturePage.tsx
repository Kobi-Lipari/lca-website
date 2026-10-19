// src/pages/fixtures/ScopeFixturePage.tsx
//
// A test page for the accessibility suite (npm run test:a11y), at
// /__fixtures/:name. It shows the shared controls (buttons, a text field, a
// table, status badges and figures in the monospace face) inside one look,
// so the browser tests can measure colours, contrast and layout in each look
// without depending on what the real pages happen to show that day.
//
// The route exists only in the accessibility test build (vite build --mode
// a11y): src/App.tsx registers it behind import.meta.env.MODE, so the site's
// own build carries neither the route nor this file.
//
// Each name draws its container in one look through ThemeScope, which puts
// data-theme on it ("" for base) and loads that look's fonts. The colours
// change only in a build with newLook on; with it off every name draws the
// site as it looks today. The scholastic fixture adds the grade band colour
// tiles, each with its band's words. test/a11y/scope-switch.spec.ts switches
// data-theme on the container in place to show a change of look moves
// nothing on the page.
import { Link, useParams } from 'react-router-dom'
import { StatusBadge } from '@/components/StatusBadge'
import { ThemeScope } from '@/components/ThemeScope'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePageTitle } from '@/hooks/usePageTitle'
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
