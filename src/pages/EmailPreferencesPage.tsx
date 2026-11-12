// src/pages/EmailPreferencesPage.tsx
//
// The page an email preferences link in optional email opens,
// /email/preferences/:token (WS16 step 5): thin, on today's look, and routed
// whatever the switches say, as the unsubscribe page is. On load it makes one
// request, getEmailChoices, which changes nothing, and draws nothing in the
// main area with mailLists off unless that request answers 200. It shows the
// masked address, one box for each list the person is on, and "Stop all
// optional email from LCA", which shows every list unticked and off while it
// is ticked; "Save my choices" sends one PATCH and the status region says
// "Saved." and takes the focus. The newsletter is listed only for an address
// in its audience, an account with an active membership; without it, a line
// says who it goes to. WS13's account rail gains a signed-in version of these
// choices under Settings; this page stays for anyone signed out, with the
// token, the endpoints and the stop-all.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { DoneBox, LinkFailedPage, LinkNotWorking, NoAnswer, PageTitle } from '@/areas/membership/components/EmailChoiceParts'
import { Button } from '@/components/ui/button'
import { FEATURES } from '@/lib/features'
import { ApiError, getEmailChoices, saveEmailChoices, type ApiEmailChoices } from '@/lib/api'
import { EVENT_MAIL_STILL_COMES } from '@domain/mail/footer'
import { NEWSLETTER_LIST_ID } from '@domain/mail/lists'
import { cn } from '@/lib/utils'

/** A list's status while "Stop all optional email from LCA" is ticked: off, in words, beside the muted box. */
const STOPPED_WITH_ALL = 'Off while all optional email is stopped.'

/** With mailLists on, each tick's row and the one button are 44px tall on a phone, the box and its words as they are. */
const TALL_ON_A_PHONE = 'max-sm:min-h-11'

/** What the page draws: nothing yet, nothing at all, the choices, or one of the two answers for a link that does not open. */
type View = { kind: 'waiting' | 'nothing' | 'not-working' | 'no-answer' } | { kind: 'page'; choices: ApiEmailChoices }

/** What came of a save: saved, a refusal in the server's own words, or one of the two answers for a link that does not open. */
type Saved = { kind: 'saved' } | { kind: 'refused'; words: string } | { kind: 'not-working' | 'no-answer' } | null

/** A 404 is a link that does not open; anything else that is not an answer of the server's is a request to try again. */
const failure = (err: unknown) => (err instanceof ApiError && err.status === 404 ? 'not-working' : 'no-answer') as 'not-working' | 'no-answer'

export function EmailPreferencesPage() {
  const { token = '' } = useParams<{ token: string }>()
  const [view, setView] = useState<View>({ kind: 'waiting' })
  const [lists, setLists] = useState<Record<string, boolean>>({})
  const [optionalOff, setOptionalOff] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Saved>(null)
  const status = useRef<HTMLDivElement>(null)
  const ids = useId()

  /** The choices as the server answered them, drawn into the boxes. */
  function show(choices: ApiEmailChoices) {
    setView({ kind: 'page', choices })
    setLists(Object.fromEntries(choices.lists.map((list) => [list.id, list.on])))
    setOptionalOff(choices.optionalOff)
  }

  // One GET, which changes nothing. With mailLists off anything but a 200 draws nothing, as an unknown path does.
  useEffect(() => {
    let cancelled = false
    getEmailChoices(token)
      .then((choices) => { if (!cancelled) show(choices) })
      .catch((err: unknown) => { if (!cancelled) setView({ kind: FEATURES.mailLists ? failure(err) : 'nothing' }) })
    return () => { cancelled = true }
  }, [token])

  // "Saved." takes the focus once it is in the region, after each save; nothing else moves the focus by itself.
  useEffect(() => {
    if (saved?.kind === 'saved') status.current?.focus()
  }, [saved])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setSaved(null)
    try {
      // While every optional email is stopped, the lists are off and their own choices are kept as they are.
      show(await saveEmailChoices(token, optionalOff ? { optionalOff: true } : { lists, optionalOff: false }))
      setSaved({ kind: 'saved' })
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setSaved({ kind: 'refused', words: err.message })
      else setSaved({ kind: failure(err) })
    } finally {
      setSaving(false)
    }
  }

  if (view.kind === 'waiting' || view.kind === 'nothing') return null

  if (view.kind !== 'page') return <LinkFailedPage title="Email choices" heading="Your email choices" notWorking={view.kind === 'not-working'} />

  const { choices } = view
  const hasNewsletter = choices.lists.some((list) => list.id === NEWSLETTER_LIST_ID)
  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <PageTitle title="Email choices" />
      <h1 className="text-2xl font-bold text-ink">Your email choices</h1>
      <p className="mt-2 text-muted-foreground">For {choices.address}.</p>
      <form className="mt-6 space-y-4" onSubmit={save}>
        {choices.lists.map((list) => {
          const box = `${ids}-${list.id}`
          const about = list.id === NEWSLETTER_LIST_ID ? `${box}-about` : undefined
          // While every optional email is stopped the row reads as off: its label muted as its box is, and its status in words.
          const offNote = optionalOff ? `${box}-off` : undefined
          const describedBy = [about, offNote].filter(Boolean).join(' ') || undefined
          return (
            <div key={list.id}>
              <label htmlFor={box} className={cn('flex min-h-6 items-center gap-2 font-medium', FEATURES.mailLists && TALL_ON_A_PHONE, optionalOff ? 'text-muted-foreground' : 'text-ink')}>
                <input
                  id={box}
                  type="checkbox"
                  className="size-4 accent-ink"
                  checked={!optionalOff && (lists[list.id] ?? false)}
                  disabled={optionalOff}
                  aria-describedby={describedBy}
                  onChange={(e) => setLists((now) => ({ ...now, [list.id]: e.target.checked }))}
                />
                {list.name}
              </label>
              {about && <p id={about} className="ml-6 text-sm text-muted-foreground">News from the Louisiana Chess Association.</p>}
              {offNote && <p id={offNote} className="ml-6 text-sm text-muted-foreground">{STOPPED_WITH_ALL}</p>}
            </div>
          )
        })}
        {!hasNewsletter && <p className="text-sm text-muted-foreground">The LCA newsletter goes to current members.</p>}
        <div>
          <label htmlFor={`${ids}-all`} className={cn('flex min-h-6 items-center gap-2 font-medium', FEATURES.mailLists && TALL_ON_A_PHONE, 'text-ink')}>
            <input
              id={`${ids}-all`}
              type="checkbox"
              className="size-4 accent-ink"
              checked={optionalOff}
              aria-describedby={`${ids}-all-about`}
              onChange={(e) => setOptionalOff(e.target.checked)}
            />
            Stop all optional email from LCA
          </label>
          <p id={`${ids}-all-about`} className="ml-6 text-sm text-muted-foreground">{EVENT_MAIL_STILL_COMES}</p>
        </div>
        <Button type="submit" variant="gold" className={FEATURES.mailLists ? TALL_ON_A_PHONE : undefined} disabled={saving}>
          Save my choices
        </Button>
      </form>
      {/* In the page before its words arrive; it takes the focus when it says "Saved.". */}
      <div ref={status} role="status" tabIndex={-1} className="mt-4 rounded-md text-ink outline-none focus:ring-3 focus:ring-ring">
        {saved?.kind === 'saved' && <DoneBox>Saved.</DoneBox>}
        {saved?.kind === 'refused' && <p>{saved.words}</p>}
        {saved?.kind === 'not-working' && <p><LinkNotWorking /></p>}
        {saved?.kind === 'no-answer' && <p><NoAnswer /></p>}
      </div>
    </div>
  )
}
