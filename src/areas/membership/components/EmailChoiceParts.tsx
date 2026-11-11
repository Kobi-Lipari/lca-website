// src/areas/membership/components/EmailChoiceParts.tsx
//
// What the two pages a link in optional email opens share (WS16 step 5),
// src/pages/EmailUnsubscribePage.tsx and src/pages/EmailPreferencesPage.tsx:
// the words for a link the server says does not open, with the way to reach
// LCA through the Contact page; the words for a request that got no answer;
// and the page's title, set only while a page draws something, so a page that
// draws nothing leaves the title as an unknown path leaves it.
import { Link } from 'react-router-dom'
import { usePageTitle } from '@/hooks/usePageTitle'

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
