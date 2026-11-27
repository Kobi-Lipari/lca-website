// src/pages/ClubsIndexPage.tsx
//
// /clubs while the new club pages are on (clubPagesOn: newClubs and newLook
// together, WS09 step 33). src/App.tsx routes the address here only then;
// with either switch off it draws today's ClubsPage, as it always has, and
// never fetches this page or the directory.
//
// This page asks for the list once, through getClubsFromOrigin(), the same
// call to the list as getClubs() with only the site's origin as the referrer
// (the address can hold a ZIP code), and chooses by its answer (src/areas/clubs/directoryRows.ts): the Clubs
// directory (src/areas/clubs/components/ClubDirectory.tsx) when the answer
// has the directory's shape, which the server sends only with CLUB_PAGES_ON
// set, and today's ClubsPage, whole, when it is today's, so the site never
// draws half a directory from today's answer. Each is a chunk of its own,
// fetched only when it is drawn. Today's page asks for the list itself, as
// it always has.
//
// It takes the call through '@/lib/api', as today's Clubs page does: so
// the sign-in library stays in the main script, where a direct import of
// the clubs module put it in a file of its own in a local build.
//
// A list that fails says so in words, with a way to try again; one that is
// slow says so after a few seconds, with the same way; neither waits behind
// an endless spinner.
import { Suspense, lazy, useEffect, useState } from 'react'

import { getClubsFromOrigin, type ApiClubDirectoryItem } from '@/lib/api'
import { directoryRowsOf } from '@/areas/clubs/directoryRows'
import { DIRECTORY_TITLE, FAILED, LOADING, SLOW, SLOW_AFTER_MS, TRY_AGAIN } from '@/areas/clubs/directoryWords'
import { usePageTitle } from '@/hooks/usePageTitle'

const Directory = lazy(() => import('@/areas/clubs/components/ClubDirectory').then((m) => ({ default: m.ClubDirectory })))
const TodaysClubsPage = lazy(() => import('@/pages/ClubsPage').then((m) => ({ default: m.ClubsPage })))

type State =
  | { kind: 'loading'; slow: boolean }
  | { kind: 'failed' }
  | { kind: 'today' }
  | { kind: 'directory'; clubs: ApiClubDirectoryItem[] }

/** The words while the list is not there, with the way to ask again once it is slow or has failed. */
function Waiting({ words, onRetry }: { words: string; onRetry?: () => void }) {
  return (
    <section className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6">
      {onRetry && <h1 className="text-2xl font-bold text-ink sm:text-3xl">{DIRECTORY_TITLE}</h1>}
      <div role="status" className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink">
        <p>{words}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center rounded-md border border-hairline bg-surface px-3 font-semibold text-ink outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-focus"
          >
            {TRY_AGAIN}
          </button>
        )}
      </div>
    </section>
  )
}

export function ClubsIndexPage() {
  usePageTitle('Clubs')
  const [state, setState] = useState<State>({ kind: 'loading', slow: false })
  const [asks, setAsks] = useState(0)

  useEffect(() => {
    let current = true
    const slow = window.setTimeout(() => {
      if (current) setState((now) => (now.kind === 'loading' ? { kind: 'loading', slow: true } : now))
    }, SLOW_AFTER_MS)
    getClubsFromOrigin()
      .then((rows) => {
        const clubs = directoryRowsOf(rows)
        if (current) setState(clubs ? { kind: 'directory', clubs } : { kind: 'today' })
      })
      .catch(() => {
        if (current) setState({ kind: 'failed' })
      })
      .finally(() => window.clearTimeout(slow))
    return () => {
      current = false
      window.clearTimeout(slow)
    }
  }, [asks])

  const retry = () => {
    setState({ kind: 'loading', slow: false })
    setAsks((n) => n + 1)
  }

  if (state.kind === 'loading') return state.slow ? <Waiting words={SLOW} onRetry={retry} /> : <Waiting words={LOADING} />
  if (state.kind === 'failed') return <Waiting words={FAILED} onRetry={retry} />
  return (
    <Suspense fallback={<Waiting words={LOADING} />}>
      {state.kind === 'today' ? <TodaysClubsPage /> : <Directory clubs={state.clubs} />}
    </Suspense>
  )
}
