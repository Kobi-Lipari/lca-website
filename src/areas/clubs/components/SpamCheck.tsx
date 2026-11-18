// src/areas/clubs/components/SpamCheck.tsx
//
// The spam check a public form draws (WS09 step 25; no page draws it yet).
// The provider's script is loaded only when this is drawn, which is when a
// form that needs it opens (src/areas/clubs/spamCheckScript.ts), never at page
// load. The widget hands its token to the form through onToken, and null
// whenever the token is gone: expired, failed or not yet given. The server
// checks the token (functions/utils/spamCheck.ts).
//
// When the script or the site key is missing, or the widget fails, it says
// "The spam check didn't load. Try again." in a status a screen reader hears,
// with a Try again button of the house size and focus ring. The provider's
// name is printed nowhere beside it, and no explaining sentence sits beside
// the control. The provider's frame is given a title in words where it has
// none. Nothing moves on by itself.
//
// Two mends of WS09 step 26, for the first form that draws it: once the
// widget fails it is taken off the page, and anything it hands back after
// that is ignored, so a failed widget can never fill the form behind the
// failure's words; and a form whose send the server refused changes
// `refresh`, which clears the token, since a token is good once, and draws
// the widget afresh for a new one.
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { loadSpamCheckScript } from '../spamCheckScript'

/** The words when the check cannot be drawn. */
const DIDNT_LOAD = 'The spam check didn\'t load. Try again.'
/** The title the provider's frame is given where it has none. */
const FRAME_TITLE = 'Spam check'

interface SpamCheckProps {
  /** The token for the form to send, or null while there is none. */
  onToken: (token: string | null) => void
  /** The site key; the build's own by default. */
  siteKey?: string
  /** Changed by the form after the server refuses a send: the token is cleared and the widget drawn afresh. */
  refresh?: number
}

export function SpamCheck({ onToken, siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY, refresh = 0 }: SpamCheckProps) {
  const box = useRef<HTMLDivElement>(null)
  const again = useRef<HTMLButtonElement>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // Where focus goes next when the control that holds it leaves the page: the widget's place after Try again, and
  // Try again itself when a second try fails from there. Focus is never left to fall to the top of the page.
  const focusNext = useRef<'box' | 'again' | null>(null)
  // The latest onToken, so a form that draws a new function each time never draws the widget again.
  const tell = useRef(onToken)
  useEffect(() => { tell.current = onToken }, [onToken])

  useEffect(() => {
    if (focusNext.current === 'again' && failed) {
      focusNext.current = null
      again.current?.focus()
    }
  }, [failed])

  useEffect(() => {
    const container = box.current
    // With no site key there is nothing to load: the words below say so, and the script is never asked for.
    if (!container || !siteKey) return
    if (focusNext.current === 'box') {
      focusNext.current = null
      container.focus()
    }
    let gone = false
    let widgetId: string | undefined
    const removeWidget = () => {
      if (widgetId === undefined) return
      const id = widgetId
      widgetId = undefined
      try { window.turnstile?.remove(id) } catch { /* the widget is already gone */ }
    }
    const fail = () => {
      if (gone) return
      // From here on this widget is done with: whatever it hands back later is ignored, and it leaves the page.
      gone = true
      const active = document.activeElement
      if (active && container.contains(active)) focusNext.current = 'again'
      tell.current(null)
      removeWidget()
      setFailed(true)
    }
    // The provider's frame, given a title in words wherever it arrives without one.
    const titles = new MutationObserver(() => {
      for (const frame of container.querySelectorAll('iframe')) if (!frame.title) frame.title = FRAME_TITLE
    })
    titles.observe(container, { childList: true, subtree: true })
    tell.current(null)
    loadSpamCheckScript().then((api) => {
      if (gone) return
      try {
        widgetId = api.render(container, {
          sitekey: siteKey,
          callback: (token) => { if (!gone) tell.current(token) },
          'error-callback': fail,
          'expired-callback': () => { if (!gone) tell.current(null) },
          'timeout-callback': () => { if (!gone) tell.current(null) },
        }) ?? undefined
        // A widget that failed while it was being drawn is taken away as soon as its id is known.
        if (gone) {
          removeWidget()
          return
        }
        for (const frame of container.querySelectorAll('iframe')) if (!frame.title) frame.title = FRAME_TITLE
      } catch {
        fail()
      }
    }, fail)
    return () => {
      gone = true
      titles.disconnect()
      removeWidget()
    }
  }, [siteKey, attempt, refresh])

  const showFailed = failed || !siteKey

  const tryAgain = () => {
    // With a site key the button leaves the page for the widget, so focus moves to the widget's place. Without
    // one the button stays, focus stays on it, and the words are written afresh so a screen reader hears them again.
    if (siteKey) focusNext.current = 'box'
    setFailed(false)
    setAttempt((n) => n + 1)
  }

  return (
    <div>
      {!showFailed && <div ref={box} tabIndex={-1} className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-focus" />}
      {/* In the page from the first draw, so a screen reader hears the words when they come. */}
      <div role="status" className="break-words text-ink">{showFailed && <span key={attempt}>{DIDNT_LOAD}</span>}</div>
      {showFailed && (
        <Button ref={again} type="button" variant="outline" className="mt-2 min-h-11 px-4" onClick={tryAgain}>
          Try again
        </Button>
      )}
    </div>
  )
}
