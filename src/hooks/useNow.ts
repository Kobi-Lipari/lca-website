import { useCallback, useEffect, useState } from 'react'

/**
 * The current time in milliseconds, kept fresh while the page stays open:
 * read again every `intervalMs`, whenever the tab comes back into view or
 * the page is restored from the browser's back-forward cache (a hidden tab's
 * timer is slowed, and a restored page keeps its old state), and at once
 * whenever `refresh` is called (from the handlers where a person is about to
 * act on a time-dependent amount). Prices shown from it then follow the early
 * deadline and the late-fee start the way checkout does, instead of the moment
 * the page opened.
 */
export function useNow(intervalMs = 30_000): [number, () => void] {
  const [now, setNow] = useState(() => Date.now())
  const refresh = useCallback(() => setNow(Date.now()), [])
  useEffect(() => {
    const timer = setInterval(refresh, intervalMs)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [intervalMs, refresh])
  return [now, refresh]
}
