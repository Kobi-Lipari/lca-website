// src/areas/membership/components/EmailChoiceParts.tsx
//
// What the two pages a link in optional email opens share (WS16 step 5),
// src/pages/EmailUnsubscribePage.tsx and src/pages/EmailPreferencesPage.tsx:
// the words for a link the server says does not open, with the way to reach
// LCA through the Contact page; the words for a request that got no answer;
// the page's title, set only while a page draws something, so a page that
// draws nothing leaves the title as an unknown path leaves it; and, since
// checkpoint M's review (K's decision 52, part B), the page a link that does
// not open draws, with its heading above the sentence, and the box a result
// of the person's own press is drawn in, a check mark beside its words.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
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

/** The page for a link that does not open, or a load that got no answer: the page's heading, then the sentence, word for word. */
export function LinkFailedPage({ title, heading, notWorking }: { title: string; heading: string; notWorking: boolean }) {
  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <PageTitle title={title} />
      <h1 className="text-2xl font-bold text-ink">{heading}</h1>
      <p className="mt-3 text-ink">{notWorking ? <LinkNotWorking /> : <NoAnswer />}</p>
    </div>
  )
}

/**
 * A result of the person's own press, drawn so it cannot be missed on a phone: a check mark and the words, unchanged,
 * in a bordered, lightly tinted box with padding on every side. It sits in the page's status region, whose words a
 * screen reader hears; the mark is drawn for the eye alone, beside words that say the same.
 */
export function DoneBox({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-ok-200 bg-ok-50 p-3">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}

/** The page's title while the page draws. */
export function PageTitle({ title }: { title: string }) {
  usePageTitle(title)
  return null
}
