// src/areas/clubs/components/RepRequestRows.tsx
//
// The keeper's rows of Ask to be its named rep (WS09 step 31), under a
// heading of their own, "Rep requests": drawn by My region after "New clubs
// to check", and by a club in My region for that club's requests alone.
// Which rows come is the server's to decide: a holder of a seat sees the
// requests of the clubs in the regions the seat covers, an LCA admin every
// one, and no one their own.
//
// Each row's heading says "Rep request · {Club} · {name} · {connection} ·
// {weekday, date}", then the member's note when there is one, drawn as text
// and wrapped anywhere, and its controls: "Email {first name}", a link that
// opens the keeper's own mail to the member's address, "Name as rep" and
// "Decline". Where this keeper cannot name the member (a member who holds
// another role, for a representative; an admin or a guest account, for
// anyone) the reason stands in words in place of Name as rep, so nobody
// presses a button that cannot work.
//
// Each button asks one question first, in a dialog built from the site's own
// parts as My region's other questions are: for Name as rep, what the member
// will be able to do and what naming replaces or moves, when it does; for
// Decline, that the member is told by email. Cancel or Escape leaves the row
// and puts the focus back on its button. Yes decides it: the row leaves, the
// list's one status says what happened in words, and the focus goes to the
// next row's heading, or to the list's heading when none is left. A request
// another keeper decided first leaves too, in the server's words; any other
// refusal (a role that has changed, a member an admin decides) leaves the
// row as it was with the server's words beside its buttons.
import { useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import { ApiError, decideRepRequest } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { HelpMark } from '@/areas/clubs/components/HelpMark'
import { REP_REQUEST_ROWS_HEADING, REP_REQUEST_ROWS_HELP } from '@/areas/clubs/repRequestRows'
import { errorWords } from '@/areas/clubs/region'
import { firstNameOf } from '@domain/clubs/newClub'
import {
  REP_DECIDE_ALREADY, REP_DECIDE_NOT_THIS_CLUBS, declineQuestion, declinedWords, namedWords, repRequestRowHeading,
} from '@domain/clubs/repRequest'
import type { RepRequestRow } from '@domain/contracts'

/** A control in a row: 44 pixels tall. */
const CONTROL = 'min-h-11 px-4 whitespace-normal'

/** A link drawn as an outline button, 44 pixels tall, with the site's focus ring. */
const LINK_BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-ink whitespace-normal break-words hover:bg-accent outline-none focus-visible:ring-3 focus-visible:ring-focus'

type Decision = 'approve' | 'decline'

/** A refusal that means the request was decided already, or is gone: the row leaves the list. */
function decidedElsewhere(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 404 || (err.status === 409 && err.message === REP_DECIDE_ALREADY) || err.message === REP_DECIDE_NOT_THIS_CLUBS)
}

export function RepRequestRows({ rows, onDecided, headingId = 'region-rep-requests-title' }: {
  rows: readonly RepRequestRow[]
  /** A row was decided, or was found decided: the page takes it out of its answer. */
  onDecided: (row: RepRequestRow) => void
  headingId?: string
}) {
  const [said, setSaid] = useState('')
  const [asking, setAsking] = useState<{ row: RepRequestRow; decision: Decision } | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<Readonly<Record<number, string>>>({})
  const heading = useRef<HTMLHeadingElement>(null)
  const rowHeadings = useRef<Map<number, HTMLHeadingElement>>(new Map())
  const buttons = useRef<Map<string, HTMLButtonElement>>(new Map())
  // The button whose press opened the question.
  const asked = useRef<string | null>(null)
  // Where the focus goes once the next draw is on the page: a row's heading, the list's heading, or a button.
  const focusNext = useRef<{ to: 'row'; id: number } | { to: 'button'; key: string } | 'list' | null>(null)
  useEffect(() => {
    const target = focusNext.current
    if (target === null) return
    focusNext.current = null
    if (target === 'list') heading.current?.focus()
    else if (target.to === 'row') rowHeadings.current.get(target.id)?.focus()
    else buttons.current.get(target.key)?.focus()
  })

  const keyOf = (row: RepRequestRow, decision: Decision) => `${row.id}:${decision}`

  /** After a row leaves: the next row's heading, or the list's when none is left. */
  function focusAfter(row: RepRequestRow) {
    const at = rows.findIndex((r) => r.id === row.id)
    const next = rows[at + 1] ?? rows[at - 1]
    focusNext.current = next ? { to: 'row', id: next.id } : 'list'
  }

  async function decide(row: RepRequestRow, decision: Decision) {
    if (busy) return
    setAsking(null)
    setBusy(true)
    setSaid('')
    setErrors((now) => ({ ...now, [row.id]: '' }))
    try {
      await decideRepRequest(row.clubId, row.id, decision === 'approve' ? { decision, role: row.memberRole } : { decision })
      setSaid(decision === 'approve' ? namedWords(row.memberName, row.clubName) : declinedWords(row.memberName))
      focusAfter(row)
      onDecided(row)
    } catch (err) {
      if (decidedElsewhere(err)) {
        setSaid(errorWords(err))
        focusAfter(row)
        onDecided(row)
      } else {
        setErrors((now) => ({ ...now, [row.id]: `Nothing changed: ${errorWords(err)}` }))
        focusNext.current = { to: 'button', key: keyOf(row, decision) }
      }
    } finally {
      setBusy(false)
    }
  }

  const keep = (key: string) => (el: HTMLButtonElement | null) => { if (el) buttons.current.set(key, el); else buttons.current.delete(key) }
  const open = (row: RepRequestRow, decision: Decision) => {
    if (busy) return
    asked.current = keyOf(row, decision)
    setAsking({ row, decision })
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="relative flex items-baseline">
        <h2 ref={heading} id={headingId} tabIndex={-1} className="text-lg font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus">
          {REP_REQUEST_ROWS_HEADING}
        </h2>
        <HelpMark name={REP_REQUEST_ROWS_HEADING} entries={REP_REQUEST_ROWS_HELP} />
      </div>
      <p role="status" className="min-w-0 break-words text-sm text-ink">{said}</p>
      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => {
            const rowHeading = `rep-request-${row.id}-title`
            const first = firstNameOf(row.memberName)
            return (
              <li key={row.id} id={`rep-request-${row.id}`} className="min-w-0 rounded-lg border border-hairline bg-card p-4">
                <article aria-labelledby={rowHeading} className="min-w-0 space-y-2">
                  <h3
                    ref={(el) => { if (el) rowHeadings.current.set(row.id, el); else rowHeadings.current.delete(row.id) }}
                    id={rowHeading}
                    tabIndex={-1}
                    className="text-base font-semibold text-ink [overflow-wrap:anywhere] outline-none focus-visible:ring-3 focus-visible:ring-focus"
                  >
                    {repRequestRowHeading(row)}
                  </h3>
                  {row.note && <blockquote className="whitespace-pre-line text-sm text-ink [overflow-wrap:anywhere]">{row.note}</blockquote>}
                  {row.noName && <p className="break-words text-sm text-ink">{row.noName}</p>}
                  {errors[row.id] && <p className="break-words text-sm font-semibold text-ink">{errors[row.id]}</p>}
                  <div className="flex flex-wrap gap-2">
                    <a href={`mailto:${encodeURIComponent(row.memberEmail)}`} className={LINK_BUTTON} aria-label={`Email ${first} about ${row.clubName}`}>
                      Email {first}
                    </a>
                    {!row.noName && (
                      <Button
                        ref={keep(keyOf(row, 'approve'))}
                        type="button"
                        className={CONTROL}
                        aria-label={`Name as rep: ${row.memberName} for ${row.clubName}`}
                        aria-disabled={busy || undefined}
                        onClick={() => open(row, 'approve')}
                      >
                        Name as rep
                      </Button>
                    )}
                    <Button
                      ref={keep(keyOf(row, 'decline'))}
                      type="button"
                      variant="outline"
                      className={CONTROL}
                      aria-label={`Decline: ${row.memberName} for ${row.clubName}`}
                      aria-disabled={busy || undefined}
                      onClick={() => open(row, 'decline')}
                    >
                      Decline
                    </Button>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
      <Dialog
        open={asking !== null}
        onOpenChange={(isOpen) => {
          if (isOpen) return
          // Cancel, Escape or a press outside: the row stays, and the focus goes back to its button.
          if (asked.current !== null) focusNext.current = { to: 'button', key: asked.current }
          setAsking(null)
        }}
      >
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            // As the dialog goes the focus goes back to the row's button; once the row has been decided and has left,
            // the list moves it on to the next row.
            onCloseAutoFocus={(e) => {
              e.preventDefault()
              if (asked.current !== null) buttons.current.get(asked.current)?.focus()
            }}
            className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 text-ink shadow-lg outline-none"
          >
            <DialogTitle className="break-words text-lg font-semibold leading-snug">
              {asking ? (asking.decision === 'approve' ? asking.row.nameQuestion : declineQuestion(asking.row.memberName)) : ''}
            </DialogTitle>
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className={CONTROL}>Cancel</Button>
              </DialogClose>
              <Button type="button" className={CONTROL} onClick={() => { if (asking) void decide(asking.row, asking.decision) }}>
                {asking?.decision === 'decline' ? 'Decline' : 'Name as rep'}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </section>
  )
}
