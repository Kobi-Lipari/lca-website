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
// Each look is set with data-theme on the fixture's container. The looks
// themselves arrive in later steps; until then every name renders in the
// base look, which is what the tests expect today.
import { Link, useParams } from 'react-router-dom'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { usePageTitle } from '@/hooks/usePageTitle'

/** Fixture name to the data-theme value its container carries ("" is the base look). */
const FIXTURE_SCOPES: Record<string, string> = {
  base: '',
  heritage: 'heritage',
  scholastic: 'scholastic',
  live: 'live',
}

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
    <div data-theme={FIXTURE_SCOPES[name]} data-fixture={name} className="bg-background text-foreground">
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
      </div>
    </div>
  )
}
