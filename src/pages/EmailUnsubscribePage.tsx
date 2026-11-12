// src/pages/EmailUnsubscribePage.tsx
//
// The page an unsubscribe link in optional email opens, /email/unsubscribe/:token
// (WS16 step 5): thin, on today's look, and routed whatever the switches say, so
// a link in mail already sent keeps opening its page. On load it makes one
// request, the GET that asks for JSON (unsubscribeLinkStatus), which changes
// nothing, so a mail scanner that opens the link unsubscribes no one; the one
// button sends the one POST. With mailLists off it draws nothing in the main
// area, as an unknown path draws nothing, unless that GET answers 200, which it
// does once a list email has gone; from then on the page works whatever the
// switch says. No address is shown. The token goes to the two endpoints alone
// and never into the page's title, which is set only while the page draws.
// WS13 restyles it with My LCA's Settings in the new look, and keeps the token,
// the endpoints and the one button.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DoneBox, LinkFailedPage, LinkNotWorking, NoAnswer, PageTitle } from '@/areas/membership/components/EmailChoiceParts'
import { Button } from '@/components/ui/button'
import { FEATURES } from '@/lib/features'
import { ApiError, unsubscribeByLink, unsubscribeLinkStatus } from '@/lib/api'
import { EVENT_MAIL_STILL_COMES } from '@domain/mail/footer'

/** What the page draws: nothing yet, nothing at all, the page, or one of the two answers for a link that does not open. */
type View = { kind: 'waiting' | 'nothing' | 'not-working' | 'no-answer' } | { kind: 'page'; list: string }

/** What came of the press. */
type Pressed = { kind: 'done'; preferencesToken: string } | { kind: 'not-working' | 'no-answer' } | null

/** A 404 is a link that does not open; anything else that is not an answer of the server's is a request to try again. */
const failure = (err: unknown) => (err instanceof ApiError && err.status === 404 ? 'not-working' : 'no-answer') as 'not-working' | 'no-answer'

/** A list's name as a sentence reads it: "the LCA newsletter", and "The LCA newsletter" at its start. */
const theList = (name: string, start = false) => `${start ? 'The' : 'the'} ${name}`

export function EmailUnsubscribePage() {
  const { token = '' } = useParams<{ token: string }>()
  const [view, setView] = useState<View>({ kind: 'waiting' })
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

  if (view.kind !== 'page') return <LinkFailedPage title="Unsubscribe" heading="Unsubscribe" notWorking={view.kind === 'not-working'} />

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
          <DoneBox>
            Done. {theList(view.list, true)} won't come to this address any more.{' '}
            <Link to={`/email/preferences/${encodeURIComponent(done.preferencesToken)}`} className="font-medium underline">
              Change your email choices
            </Link>
          </DoneBox>
        )}
        {pressed?.kind === 'not-working' && <p><LinkNotWorking /></p>}
        {pressed?.kind === 'no-answer' && <p><NoAnswer /></p>}
      </div>
    </div>
  )
}
