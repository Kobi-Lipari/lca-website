// src/areas/clubs/spamCheckScript.ts
//
// The spam check's script, loaded from its provider only when a form that
// needs it is drawn (src/areas/clubs/components/SpamCheck.tsx, WS09 step
// 25): never at page load and never from the main script. It is added to the
// page once; while it loads, every widget waits on the same load, and a load
// that fails takes its tag away again, so Try again asks for it afresh.

/** The provider's script, asked to draw a widget only where the page says ("explicit"). */
export const SPAM_CHECK_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
/** How long the page waits for the script before it says the check didn't load. */
export const SPAM_CHECK_LOAD_MS = 15_000

/** What the provider's script puts on the window: the part of it the widget calls. */
export interface SpamCheckApi {
  render(container: HTMLElement, options: {
    sitekey: string
    callback: (token: string) => void
    'error-callback': () => void
    'expired-callback': () => void
    'timeout-callback': () => void
  }): string | undefined
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: SpamCheckApi
  }
}

let loading: Promise<SpamCheckApi> | null = null

/** The provider's script, loaded once; rejects when it cannot be loaded, and the next call tries again. */
export function loadSpamCheckScript(): Promise<SpamCheckApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loading) return loading
  loading = new Promise<SpamCheckApi>((resolve, reject) => {
    const script = document.createElement('script')
    const fail = () => {
      clearTimeout(timer)
      script.remove()
      loading = null
      reject(new Error('The spam check could not be loaded.'))
    }
    script.src = SPAM_CHECK_SCRIPT
    script.async = true
    script.dataset.lcaSpamCheck = '1'
    script.onload = () => {
      clearTimeout(timer)
      if (window.turnstile) resolve(window.turnstile)
      else fail()
    }
    script.onerror = fail
    const timer = setTimeout(fail, SPAM_CHECK_LOAD_MS)
    document.head.appendChild(script)
  })
  return loading
}
