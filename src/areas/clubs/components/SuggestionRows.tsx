// src/areas/clubs/components/SuggestionRows.tsx
//
// The keeper's rows for visitors' suggestions (WS09 step 28): one row for
// each open suggestion, with which of the six parts it names, the visitor's
// words, its age in words and whether an address was left, said in words and
// never by colour alone. My region draws them as its to-do list under the
// cards (`todo`), each row naming its club, with Reply, Apply this and Not an
// issue; a club's page in My region, the admin club page and Your club's page
// draw them as the club's banner (`banner`), with Fix the listing, Reply to
// visitor and Not an issue. Reply is offered only when the visitor left an
// address; a row with none says there is no one to reply to.
//
// The visitor's words are a stranger's: drawn as text, never as markup, and
// wrapped anywhere, so a long word cannot push the page sideways. The address
// is never in the page's answer, so it is never here.
//
// Apply this (Fix the listing) marks the row applied and hands the page the
// row, which takes the keeper to the club's editor. Reply opens a box for the
// keeper's words under the row; Send reply sends them from LCA's own
// address and marks the row answered. Not an issue marks it so. After each,
// the row leaves the list and the list's one status says what was done in
// words. The focus goes to the next row's heading, or to the list's heading
// when none is left. A suggestion another keeper handled first is said in
// the server's words and leaves the list too. One mark beside the list's
// heading holds what the list is for and how a reply goes; nothing opens by
// itself.
//
// A row passed on to the LCA admins after 14 days with no answer (WS09 step
// 29) says so in one line under its age, with the day and its weekday; a row
// not passed on draws as before. My region hands the to-do list the LCA
// admin's button for those rows (`tools`), drawn under the list's heading.
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { ApiError, resolveClubSuggestion } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { HelpMark } from '@/areas/clubs/components/HelpMark'
import { ROWS_HELP } from '@/areas/clubs/suggestionRows'
import { errorWords } from '@/areas/clubs/region'
import { RESOLVED_WORDS, ageWords, suggestionLabel } from '@domain/clubs/suggestion'
import { replyFieldError } from '@domain/clubs/replyMessage'
import type { OpenSuggestion, SuggestionAction } from '@domain/contracts'

export type { OpenSuggestion } from '@domain/contracts'
import { passedOnWords, useRowsShown, type SuggestionRow } from '@/areas/clubs/suggestionRows'

/** The list's two forms: My region's to-do list, and one club's banner. */
export type RowsKind = 'todo' | 'banner'

/** The words of each row's three buttons, by the list's form. */
const BUTTONS: Record<RowsKind, { apply: string; reply: string; dismiss: string }> = {
  todo: { apply: 'Apply this', reply: 'Reply', dismiss: 'Not an issue' },
  banner: { apply: 'Fix the listing', reply: 'Reply to visitor', dismiss: 'Not an issue' },
}

/** A control in a row: 44 pixels tall. */
const CONTROL = 'min-h-11 px-4 whitespace-normal'

/** A box of several lines, with the site's focus ring. */
const LINES =
  'flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-invalid:border-destructive md:text-sm'

/** The status a 409 answers with: the suggestion was handled already, so the row leaves the list. */
function handledElsewhere(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 409 || err.status === 404)
}

export function SuggestionRows({
  kind, rows, onResolved, onApplied, headingId = 'club-suggestions-title', tools,
}: {
  kind: RowsKind
  rows: readonly SuggestionRow[]
  /** A row is resolved, or was found handled: the page takes it out of its answer. */
  onResolved: (row: SuggestionRow) => void
  /** A row was marked applied: the page takes the keeper to the club's editor. */
  onApplied: (row: SuggestionRow) => void
  headingId?: string
  /** What the page draws under the list's heading, My region's button for the LCA admins (WS09 step 29); nothing when absent. */
  tools?: ReactNode
}) {
  const words = BUTTONS[kind]
  const [said, setSaid] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [errors, setErrors] = useState<Readonly<Record<number, string>>>({})
  const [replying, setReplying] = useState<number | null>(null)
  const [reply, setReply] = useState('')
  const [replyError, setReplyError] = useState('')
  const heading = useRef<HTMLHeadingElement>(null)
  const rowHeadings = useRef<Map<number, HTMLHeadingElement>>(new Map())
  const replyBox = useRef<HTMLTextAreaElement>(null)
  // The reply box with its Send reply and Cancel, brought into sight above a phone's bottom bar as it opens.
  const replyArea = useRef<HTMLDivElement>(null)
  // Where the focus goes once the next draw is on the page: a row's heading, the list's heading, or the reply box.
  const focusNext = useRef<number | 'list' | 'reply' | null>(null)
  useEffect(() => {
    const target = focusNext.current
    if (target === null) return
    focusNext.current = null
    if (target === 'reply') {
      replyBox.current?.focus()
      replyArea.current?.scrollIntoView?.({ block: 'nearest' })
    }
    else if (target === 'list') heading.current?.focus()
    else rowHeadings.current.get(target)?.focus()
  })

  /** After a row leaves: the next row's heading, or the list's when none is left. */
  function focusAfter(row: SuggestionRow) {
    const at = rows.findIndex((r) => r.id === row.id)
    const next = rows[at + 1] ?? rows[at - 1]
    focusNext.current = next ? next.id : 'list'
  }

  async function act(row: SuggestionRow, action: SuggestionAction) {
    if (busy !== null) return
    if (action === 'answer') {
      const error = replyFieldError(reply)
      if (error) {
        setReplyError(error)
        focusNext.current = 'reply'
        setSaid('')
        return
      }
    }
    setBusy(row.id)
    setSaid('')
    setErrors((now) => ({ ...now, [row.id]: '' }))
    try {
      const done = await resolveClubSuggestion(row.clubId, row.id, action === 'answer' ? { action, message: reply.trim() } : { action })
      const prefix = kind === 'todo' ? `${row.clubName}: ` : ''
      setSaid(`${prefix}${RESOLVED_WORDS[done.status]}`)
      setReplying(null)
      setReply('')
      setReplyError('')
      focusAfter(row)
      onResolved(row)
      if (done.status === 'applied') onApplied(row)
    } catch (err) {
      if (handledElsewhere(err)) {
        setSaid(errorWords(err))
        focusAfter(row)
        onResolved(row)
      } else {
        setErrors((now) => ({ ...now, [row.id]: `Nothing changed: ${errorWords(err)}` }))
      }
    } finally {
      setBusy(null)
    }
  }

  function openReply(row: SuggestionRow) {
    setReplying(row.id)
    setReply('')
    setReplyError('')
    focusNext.current = 'reply'
  }

  function cancelReply(row: SuggestionRow) {
    setReplying(null)
    setReply('')
    setReplyError('')
    focusNext.current = row.id
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="relative flex items-baseline">
        <h2 ref={heading} id={headingId} tabIndex={-1} className="text-lg font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus">
          {kind === 'todo' ? 'Suggestions to answer' : 'Suggestions from visitors'}
        </h2>
        <HelpMark name={kind === 'todo' ? 'Suggestions to answer' : 'Suggestions from visitors'} entries={ROWS_HELP} />
      </div>
      {tools}
      <p role="status" className="min-w-0 break-words text-sm text-ink">{said}</p>
      {rows.length > 0 && (
        <ul className="space-y-3">
          {rows.map((row) => {
            const rowHeading = `suggestion-${row.id}-title`
            const label = suggestionLabel(row.field)
            const named = kind === 'todo' ? `${row.clubName}: ${label}` : label
            return (
              <li key={row.id} id={`suggestion-${row.id}`} className="min-w-0 rounded-lg border border-warn-300 bg-card p-4">
                <article aria-labelledby={rowHeading} className="min-w-0 space-y-2">
                  <h3
                    ref={(el) => { if (el) rowHeadings.current.set(row.id, el); else rowHeadings.current.delete(row.id) }}
                    id={rowHeading}
                    tabIndex={-1}
                    className="break-words text-base font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
                  >
                    {named}
                  </h3>
                  <p className="text-sm text-ink-muted">Suggested {row.ageDays <= 0 ? 'today' : `${ageWords(row.ageDays)} ago`}</p>
                  {row.passedOnAt && <p className="text-sm text-ink">{passedOnWords(row.passedOnAt)}</p>}
                  <blockquote className="whitespace-pre-line text-sm text-ink [overflow-wrap:anywhere]">{row.message}</blockquote>
                  <p className="text-sm text-ink">{row.hasAddress ? 'They left an email address, so you can reply.' : 'No email address was left, so there is no one to reply to.'}</p>
                  {errors[row.id] && <p className="break-words text-sm font-semibold text-ink">{errors[row.id]}</p>}
                  {replying === row.id ? (
                    <div ref={replyArea} className="scroll-mb-[calc(var(--bottom-chrome-h,0px)+1rem)] space-y-2">
                      <Label htmlFor={`suggestion-${row.id}-reply`}>Your reply</Label>
                      <textarea
                        ref={replyBox}
                        id={`suggestion-${row.id}-reply`}
                        value={reply}
                        readOnly={busy === row.id || undefined}
                        aria-invalid={replyError ? true : undefined}
                        aria-describedby={replyError ? `suggestion-${row.id}-reply-error` : undefined}
                        className={LINES}
                        onChange={(e) => { setReply(e.target.value); if (replyError) setReplyError('') }}
                      />
                      {replyError && <p id={`suggestion-${row.id}-reply-error`} className="text-sm font-semibold text-destructive">{replyError}</p>}
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" className={CONTROL} aria-disabled={busy === row.id || undefined} onClick={() => { void act(row, 'answer') }}>
                          {busy === row.id ? 'Sending…' : 'Send reply'}
                        </Button>
                        <Button type="button" variant="outline" className={CONTROL} onClick={() => cancelReply(row)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {row.hasAddress && (
                        <Button type="button" variant="outline" className={CONTROL} aria-label={`${words.reply}: ${named}`} onClick={() => openReply(row)}>
                          {words.reply}
                        </Button>
                      )}
                      <Button type="button" className={CONTROL} aria-label={`${words.apply}: ${named}`} aria-disabled={busy === row.id || undefined} onClick={() => { void act(row, 'apply') }}>
                        {words.apply}
                      </Button>
                      <Button type="button" variant="outline" className={CONTROL} aria-label={`${words.dismiss}: ${named}`} aria-disabled={busy === row.id || undefined} onClick={() => { void act(row, 'dismiss') }}>
                        {words.dismiss}
                      </Button>
                    </div>
                  )}
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/**
 * One club's banner of its open suggestions, as the club's page in My
 * region, the admin club page and Your club's page draw it: the rows the
 * club's answer gave, less those answered here since. With none from the
 * start it draws nothing at all, so the page is as it was.
 */
export function ClubSuggestionsBanner({
  suggestions, clubId, clubName, onApplied, className,
}: {
  suggestions: readonly OpenSuggestion[]
  clubId: string
  clubName: string
  /** A row was marked applied: the page shows the club's editor. */
  onApplied: () => void
  className?: string
}) {
  const [answered, setAnswered] = useState<ReadonlySet<number>>(() => new Set())
  const rows: SuggestionRow[] = suggestions.filter((row) => !answered.has(row.id)).map((row) => ({ ...row, clubId, clubName }))
  const shown = useRowsShown(rows.length > 0)
  if (!shown) return null
  return (
    <div className={className}>
      <SuggestionRows kind="banner" rows={rows} onResolved={(row) => setAnswered((now) => new Set(now).add(row.id))} onApplied={onApplied} />
    </div>
  )
}
