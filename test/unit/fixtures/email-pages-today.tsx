// test/unit/fixtures/email-pages-today.tsx
//
// The two pages a member's link opens and the parts they share, as they stood
// at commit 24bcf50, WS16 step 8, before checkpoint M's review, kept word for
// word but for this comment, the three exports' names (EmailUnsubscribePageToday
// and EmailPreferencesPageToday, with the parts' own names kept), the names of the two pages'
// private types, which are made apart so they sit in one file, and the one
// helper the two pages both wrote, which is written once. The pages' own
// comments are left out. test/unit/email-pages-review.test.tsx draws each of
// them beside the live page and holds the two the same where checkpoint M's
// review changes nothing a person meets, and the one thing it changes where it does.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { FEATURES } from '@/lib/features'
import { ApiError, getEmailChoices, saveEmailChoices, unsubscribeByLink, unsubscribeLinkStatus, type ApiEmailChoices } from '@/lib/api'
import { EVENT_MAIL_STILL_COMES } from '@domain/mail/footer'
import { NEWSLETTER_LIST_ID } from '@domain/mail/lists'

/** For a link the server answers 404: it does not open, and the way to reach LCA instead. */
export function LinkNotWorking() {
  return (
    <>
      This link isn't working. Use the link in the latest LCA newsletter, or write to us through the{' '}
      <Link to="/contact" className="font-medium text-ink underline">Contact page</Link>.
    </>
  )
}

/** For a request that got no answer, or an answer that was not the server's own: the person tries again. */
export function NoAnswer() {
  return <>That didn't go through. Try again.</>
}

/** The page's title while the page draws. */
export function PageTitle({ title }: { title: string }) {
  usePageTitle(title)
  return null
}

/** What the page draws: nothing yet, nothing at all, the page, or one of the two answers for a link that does not open. */
type UnsubscribeView = { kind: 'waiting' | 'nothing' | 'not-working' | 'no-answer' } | { kind: 'page'; list: string }

/** What came of the press. */
type Pressed = { kind: 'done'; preferencesToken: string } | { kind: 'not-working' | 'no-answer' } | null

/** A 404 is a link that does not open; anything else that is not an answer of the server's is a request to try again. */
const failure = (err: unknown) => (err instanceof ApiError && err.status === 404 ? 'not-working' : 'no-answer') as 'not-working' | 'no-answer'

/** A list's name as a sentence reads it: "the LCA newsletter", and "The LCA newsletter" at its start. */
const theList = (name: string, start = false) => `${start ? 'The' : 'the'} ${name}`

export function EmailUnsubscribePageToday() {
  const { token = '' } = useParams<{ token: string }>()
  const [view, setView] = useState<UnsubscribeView>({ kind: 'waiting' })
  const [pressing, setPressing] = useState(false)
  const [pressed, setPressed] = useState<Pressed>(null)

  // One GET, which changes nothing. With mailLists off anything but a 200 draws nothing, as an unknown path does.
  useEffect(() => {
    let cancelled = false
    unsubscribeLinkStatus(token)
      .then((link) => { if (!cancelled) setView({ kind: 'page', list: link.list }) })
      .catch((err: unknown) => { if (!cancelled) setView({ kind: FEATURES.mailLists ? failure(err) : 'nothing' }) })
    return () => { cancelled = true }
  }, [token])

  /** The one press: the one POST. */
  async function unsubscribe() {
    setPressing(true)
    setPressed(null)
    try {
      const done = await unsubscribeByLink(token)
      setPressed({ kind: 'done', preferencesToken: done.preferencesToken })
    } catch (err) {
      setPressed({ kind: failure(err) })
    } finally {
      setPressing(false)
    }
  }

  if (view.kind === 'waiting' || view.kind === 'nothing') return null

  if (view.kind !== 'page') {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <PageTitle title="Unsubscribe" />
        <p className="text-ink">{view.kind === 'not-working' ? <LinkNotWorking /> : <NoAnswer />}</p>
      </div>
    )
  }

  const done = pressed?.kind === 'done' ? pressed : null
  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <PageTitle title="Unsubscribe" />
      <h1 className="text-2xl font-bold text-ink">Stop {theList(view.list)}?</h1>
      <p className="mt-3 text-ink">This stops {theList(view.list)} at this address.</p>
      <p className="mt-1 text-muted-foreground">{EVENT_MAIL_STILL_COMES}</p>
      {!done && pressed?.kind !== 'not-working' && (
        <Button type="button" variant="gold" className="mt-6" disabled={pressing} onClick={unsubscribe}>
          Unsubscribe
        </Button>
      )}
      {/* In the page before its words arrive, so a screen reader hears each result. */}
      <div role="status" className="mt-4 text-ink">
        {done && (
          <p>
            Done. {theList(view.list, true)} won't come to this address any more.{' '}
            <Link to={`/email/preferences/${encodeURIComponent(done.preferencesToken)}`} className="font-medium underline">
              Change your email choices
            </Link>
          </p>
        )}
        {pressed?.kind === 'not-working' && <p><LinkNotWorking /></p>}
        {pressed?.kind === 'no-answer' && <p><NoAnswer /></p>}
      </div>
    </div>
  )
}

/** What the page draws: nothing yet, nothing at all, the choices, or one of the two answers for a link that does not open. */
type PreferencesView = { kind: 'waiting' | 'nothing' | 'not-working' | 'no-answer' } | { kind: 'page'; choices: ApiEmailChoices }

/** What came of a save: saved, a refusal in the server's own words, or one of the two answers for a link that does not open. */
type Saved = { kind: 'saved' } | { kind: 'refused'; words: string } | { kind: 'not-working' | 'no-answer' } | null

export function EmailPreferencesPageToday() {
  const { token = '' } = useParams<{ token: string }>()
  const [view, setView] = useState<PreferencesView>({ kind: 'waiting' })
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

  if (view.kind !== 'page') {
    return (
      <div className="mx-auto max-w-lg px-6 py-16">
        <PageTitle title="Email choices" />
        <p className="text-ink">{view.kind === 'not-working' ? <LinkNotWorking /> : <NoAnswer />}</p>
      </div>
    )
  }

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
          return (
            <div key={list.id}>
              <label htmlFor={box} className="flex min-h-6 items-center gap-2 font-medium text-ink">
                <input
                  id={box}
                  type="checkbox"
                  className="size-4 accent-ink"
                  checked={!optionalOff && (lists[list.id] ?? false)}
                  disabled={optionalOff}
                  aria-describedby={about}
                  onChange={(e) => setLists((now) => ({ ...now, [list.id]: e.target.checked }))}
                />
                {list.name}
              </label>
              {about && <p id={about} className="ml-6 text-sm text-muted-foreground">News from the Louisiana Chess Association.</p>}
            </div>
          )
        })}
        {!hasNewsletter && <p className="text-sm text-muted-foreground">The LCA newsletter goes to current members.</p>}
        <div>
          <label htmlFor={`${ids}-all`} className="flex min-h-6 items-center gap-2 font-medium text-ink">
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
        <Button type="submit" variant="gold" disabled={saving}>
          Save my choices
        </Button>
      </form>
      {/* In the page before its words arrive; it takes the focus when it says "Saved.". */}
      <div ref={status} role="status" tabIndex={-1} className="mt-4 rounded-md text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus">
        {saved?.kind === 'saved' && <p>Saved.</p>}
        {saved?.kind === 'refused' && <p>{saved.words}</p>}
        {saved?.kind === 'not-working' && <p><LinkNotWorking /></p>}
        {saved?.kind === 'no-answer' && <p><NoAnswer /></p>}
      </div>
    </div>
  )
}
