// src/pages/SuggestClubPage.tsx
//
// Suggest a club and Start a club (WS09 step 30), at /clubs/suggest while
// newClubs is on, in place of the way to today's contact page that stood
// there since WS09 step 21. One form with a switch
// (src/areas/clubs/components/SuggestClubForm.tsx): /clubs/suggest opens
// Suggest a club and /clubs/suggest?kind=start opens Start a club, so a link
// can open either, and a press of the switch moves the address in place. The
// page's heading and the document's title follow the switch. The page is
// fetched the first time it is opened, and the server alone knows where a
// suggestion goes: the page names no region, no seat and no person.
import { useSearchParams } from 'react-router-dom'

import { usePageTitle } from '@/hooks/usePageTitle'
import { SuggestClubForm } from '@/areas/clubs/components/SuggestClubForm'
import { START_QUERY, kindOfQuery } from '@/areas/clubs/suggestClub'
import { CLUB_REQUEST_TITLES, type ClubRequestKind } from '@domain/clubs/newClub'

export function SuggestClubPage() {
  const [params, setParams] = useSearchParams()
  const kind = kindOfQuery(params.get('kind'))
  const title = CLUB_REQUEST_TITLES[kind]
  usePageTitle(title)

  function choose(next: ClubRequestKind) {
    setParams(next === 'start_club' ? { kind: START_QUERY } : {}, { replace: true })
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="mb-6 break-words text-2xl font-bold text-ink">{title}</h1>
      <SuggestClubForm kind={kind} onKind={choose} />
    </div>
  )
}
