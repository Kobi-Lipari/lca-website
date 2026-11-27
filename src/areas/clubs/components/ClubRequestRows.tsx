// src/areas/clubs/components/ClubRequestRows.tsx
//
// The keeper's rows for Suggest a club and Start a club (WS09 step 30), drawn
// by My region under its to-do list of suggestions, under a small heading of
// their own, "New clubs to check": their controls are not a suggestion's, and
// a row of these kinds has no club. A holder of a seat sees the rows of the
// regions the seat covers; an LCA admin sees every row, those whose place was
// not found among them; the server decides which.
//
// Each row says which of the two it is in words ("New club suggested",
// "Wants to start a club") with the club's name, then its age, the place as
// typed, the region or that none was found, the person's words of where and
// when, and who sent it. Its controls: "Email {first name}", a link that opens
// the keeper's own mail to the person's address, and Mark as handled; an LCA
// admin's row also has "Add the club", a plain link to Admin's clubs, where a
// club is added (a representative cannot add a club, so their rows have
// none). This is the one place the person's name and address are shown, and
// only until the row is handled.
//
// Mark as handled asks one question in words first, in a dialog built from
// the site's own dialog parts as My region's other questions are. Cancel or
// Escape leaves the row as it was and puts the focus back on its Mark as
// handled. Yes marks it: the row leaves the list, the list's one status says
// what was done in words, and the focus goes to the next row's heading, or to
// the list's heading when none is left. A row another keeper handled first is
// said in the server's words and leaves the list too.
//
// A stranger's words are drawn as text, never as markup, and wrapped
// anywhere, so a long word cannot push the page sideways.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import { ApiError, markClubRequestHandled } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { HelpMark } from '@/areas/clubs/components/HelpMark'
import { CLUB_REQUEST_ROWS_HELP, MARKED_HANDLED, MARK_HANDLED_QUESTION } from '@/areas/clubs/clubRequestRows'
import { errorWords } from '@/areas/clubs/region'
import { ageWords } from '@domain/clubs/suggestion'
import { CLUB_REQUEST_ROW_WORDS, firstNameOf } from '@domain/clubs/newClub'
import type { ClubRequestRow } from '@domain/contracts'

/** A control in a row: 44 pixels tall. */
const CONTROL = 'min-h-11 px-4 whitespace-normal'

/** A link drawn as an outline button, 44 pixels tall, with the site's focus ring. */
const LINK_BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-ink whitespace-normal break-words hover:bg-accent outline-none focus-visible:ring-3 focus-visible:ring-focus'

/** The words of a refusal that means the row was handled already, or is gone: it leaves the list. */
function handledElsewhere(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 409 || err.status === 404)
}

export function ClubRequestRows({ rows, isAdmin, onHandled, headingId = 'region-club-requests-title' }: {
  rows: readonly ClubRequestRow[]
  /** An LCA admin's rows also link to Admin's clubs, where a club is added. */
  isAdmin: boolean
  /** A row was marked, or was found handled: the page takes it out of its answer. */
  onHandled: (row: ClubRequestRow) => void
  headingId?: string
}) {
  const [said, setSaid] = useState('')
  const [asking, setAsking] = useState<ClubRequestRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Readonly<Record<number, string>>>({})
  const heading = useRef<HTMLHeadingElement>(null)
  const rowHeadings = useRef<Map<number, HTMLHeadingElement>>(new Map())
  const markButtons = useRef<Map<number, HTMLButtonElement>>(new Map())
  // The row whose Mark as handled opened the question.
  const asked = useRef<number | null>(null)
  // Where the focus goes once the next draw is on the page: a row's heading, the list's heading, or a row's button.
  const focusNext = useRef<{ to: 'row' | 'button'; id: number } | 'list' | null>(null)
  useEffect(() => {
    const target = focusNext.current
    if (target === null) return
    focusNext.current = null
    if (target === 'list') heading.current?.focus()
    else if (target.to === 'row') rowHeadings.current.get(target.id)?.focus()
    else markButtons.current.get(target.id)?.focus()
  })

  /** After a row leaves: the next row's heading, or the list's when none is left. */
  function focusAfter(row: ClubRequestRow) {
    const at = rows.findIndex((r) => r.id === row.id)
    const next = rows[at + 1] ?? rows[at - 1]
    focusNext.current = next ? { to: 'row', id: next.id } : 'list'
  }

  async function mark(row: ClubRequestRow) {
    if (busy) return
    setAsking(null)
    setBusy(true)
    setSaid('')
    setErrors((now) => ({ ...now, [row.id]: '' }))
    try {
      await markClubRequestHandled(row.id)
      setSaid(`${row.clubName}: ${MARKED_HANDLED}`)
      focusAfter(row)
      onHandled(row)
    } catch (err) {
      if (handledElsewhere(err)) {
        setSaid(errorWords(err))
        focusAfter(row)
        onHandled(row)
      } else {
        // Said in the list's one status too, so a screen reader hears it, as the page's own failures are.
        const failed = `Nothing changed: ${errorWords(err)}`
        setErrors((now) => ({ ...now, [row.id]: failed }))
        setSaid(failed)
        focusNext.current = { to: 'button', id: row.id }
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="relative flex items-baseline">
        <h2 ref={heading} id={headingId} tabIndex={-1} className="text-lg font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus">
          New clubs to check
        </h2>
        <HelpMark name="New clubs to check" entries={CLUB_REQUEST_ROWS_HELP} />
      </div>
      <p role="status" className="min-w-0 break-words text-sm text-ink">{said}</p>
      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => {
            const rowHeading = `club-request-${row.id}-title`
            const named = `${CLUB_REQUEST_ROW_WORDS[row.kind]}: ${row.clubName}`
            const first = firstNameOf(row.name)
            // The row's own line of a failed press, which describes the button that keeps the focus.
            const errorId = `club-request-${row.id}-error`
            return (
              <li key={row.id} id={`club-request-${row.id}`} className="min-w-0 rounded-lg border border-hairline bg-card p-4">
                <article aria-labelledby={rowHeading} className="min-w-0 space-y-2">
                  <h3
                    ref={(el) => { if (el) rowHeadings.current.set(row.id, el); else rowHeadings.current.delete(row.id) }}
                    id={rowHeading}
                    tabIndex={-1}
                    className="text-base font-semibold text-ink [overflow-wrap:anywhere] outline-none focus-visible:ring-3 focus-visible:ring-focus"
                  >
                    {named}
                  </h3>
                  <p className="text-sm text-ink-muted">Sent {ageWords(row.ageDays)}</p>
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm text-ink">
                    <dt className="font-medium">City or ZIP</dt>
                    <dd className="[overflow-wrap:anywhere]">{row.place}</dd>
                    <dt className="font-medium">Region</dt>
                    <dd className="[overflow-wrap:anywhere]">{row.region ?? 'None: the place was not found'}</dd>
                    <dt className="font-medium">From</dt>
                    <dd className="[overflow-wrap:anywhere]">{row.name}</dd>
                  </dl>
                  <blockquote className="whitespace-pre-line text-sm text-ink [overflow-wrap:anywhere]">{row.message}</blockquote>
                  {errors[row.id] && <p id={errorId} className="break-words text-sm font-semibold text-ink">{errors[row.id]}</p>}
                  <div className="flex flex-wrap gap-2">
                    <a href={`mailto:${encodeURIComponent(row.email)}`} className={LINK_BUTTON} aria-label={`Email ${first} about ${row.clubName}`}>
                      Email {first}
                    </a>
                    <Button
                      ref={(el) => { if (el) markButtons.current.set(row.id, el); else markButtons.current.delete(row.id) }}
                      type="button"
                      className={CONTROL}
                      aria-label={`Mark as handled: ${named}`}
                      aria-describedby={errors[row.id] ? errorId : undefined}
                      aria-disabled={busy || undefined}
                      onClick={() => { if (!busy) { asked.current = row.id; setAsking(row) } }}
                    >
                      Mark as handled
                    </Button>
                    {isAdmin && (
                      <Link to="/admin/clubs" className={LINK_BUTTON} aria-label={`Add the club: ${row.clubName}`}>
                        Add the club
                      </Link>
                    )}
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
      <Dialog
        open={asking !== null}
        onOpenChange={(open) => {
          if (open) return
          // Cancel, Escape or a press outside: the row stays, and the focus goes back to its Mark as handled.
          if (asked.current !== null) focusNext.current = { to: 'button', id: asked.current }
          setAsking(null)
        }}
      >
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            // As the dialog goes the focus goes back to the row's Mark as handled; once the row has been marked and has
            // left, the list moves it on to the next row.
            onCloseAutoFocus={(e) => {
              e.preventDefault()
              if (asked.current !== null) markButtons.current.get(asked.current)?.focus()
            }}
            className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 text-ink shadow-lg outline-none"
          >
            <DialogTitle className="break-words text-lg font-semibold leading-snug">{MARK_HANDLED_QUESTION}</DialogTitle>
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className={CONTROL}>Cancel</Button>
              </DialogClose>
              <Button type="button" className={CONTROL} onClick={() => { if (asking) void mark(asking) }}>
                Mark as handled
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </section>
  )
}
